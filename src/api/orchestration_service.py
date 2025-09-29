# Copyright (c) Microsoft. All rights reserved.
# Licensed under the MIT license. See LICENSE.md file in the project root for full license information.

import asyncio
import logging
import os
from typing import Dict, List, Optional, AsyncGenerator

from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

# Semantic Kernel imports for Magentic Orchestration
from semantic_kernel.agents import (
    AzureAIAgent, 
    StandardMagenticManager, 
    MagenticOrchestration
)
from semantic_kernel.agents.runtime import InProcessRuntime
from semantic_kernel.connectors.ai.azure_ai_inference import AzureAIInferenceChatCompletion
from semantic_kernel.contents import ChatMessageContent
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator

# Create a logger for this module
logger = logging.getLogger("azureaiapp.orchestration")

class SemanticKernelOrchestrationService:
    """Service for managing multi-agent orchestration using Semantic Kernel's Magentic Orchestrator"""
    
    def __init__(self, ai_project: AIProjectClient):
        self.ai_project = ai_project
        self.agents: Dict[str, AzureAIAgent] = {}
        self.manager: Optional[StandardMagenticManager] = None
        self.orchestration: Optional[MagenticOrchestration] = None
        self.runtime: Optional[InProcessRuntime] = None
        self.agent_definitions = {}
        
    async def initialize_orchestration(self, agent_ids: List[str]):
        """Initialize the Magentic Orchestration with multiple Azure AI agents"""
        try:
            logger.info(f"Initializing orchestration with agent IDs: {agent_ids}")
            
            # Create Azure credential
            creds = DefaultAzureCredential()
            
            # Create AzureAIAgent client - using the project's agents client
            client = self.ai_project.agents
            
            # Initialize agents
            for agent_id in agent_ids:
                try:
                    # Get agent definition from Azure AI
                    agent_def = await client.get_agent(agent_id)
                    self.agent_definitions[agent_id] = agent_def
                    
                    # Create Semantic Kernel AzureAIAgent
                    sk_agent = AzureAIAgent(
                        client=client,
                        definition=agent_def
                    )
                    
                    self.agents[agent_id] = sk_agent
                    logger.info(f"Successfully initialized agent {agent_id} with name: {agent_def.name}")
                    
                except Exception as e:
                    logger.error(f"Failed to initialize agent {agent_id}: {e}")
                    raise
            
            if len(self.agents) < 2:
                raise ValueError("At least 2 agents are required for Magentic Orchestration")
            
            # Create chat completion service for the manager
            # We'll use the project's connection to create the chat completion service
            # Using the same model as the individual agents for consistency
            ai_model_id = os.environ.get("AZURE_AI_AGENT_DEPLOYMENT_NAME", "gpt-4o-mini")
            
            # Get the AI Project endpoint from environment
            project_endpoint = os.getenv("AZURE_EXISTING_AIPROJECT_ENDPOINT") or os.getenv("AZURE_AI_AGENT_ENDPOINT")
            
            chat_completion = AzureAIInferenceChatCompletion(
                ai_model_id=ai_model_id,
                endpoint=project_endpoint,  # Use the AI Project endpoint
                # No api_key needed - will use DefaultAzureCredential automatically
            )
            
            # Create the Magentic Manager
            self.manager = StandardMagenticManager(chat_completion_service=chat_completion)
            
            # Create the Magentic Orchestration
            agent_list = list(self.agents.values())
            self.orchestration = MagenticOrchestration(
                members=agent_list,
                manager=self.manager,
                agent_response_callback=self._agent_response_callback,
            )
            
            # Initialize the runtime
            self.runtime = InProcessRuntime()
            self.runtime.start()
            
            logger.info("Magentic Orchestration initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize orchestration: {e}")
            raise
    
    def _agent_response_callback(self, message: ChatMessageContent) -> None:
        """Callback function to handle agent responses during orchestration"""
        logger.info(f"Agent Response - {message.name}: {message.content}")
    
    async def invoke_orchestration(
        self, 
        task: str, 
        carrier: Optional[Dict] = None
    ) -> AsyncGenerator[str, None]:
        """Invoke the Magentic Orchestration with a task and stream responses"""
        try:
            if not self.orchestration or not self.runtime:
                raise ValueError("Orchestration not initialized. Call initialize_orchestration first.")
            
            logger.info(f"Invoking orchestration with task: {task}")
            
            # Start tracing context if provided
            if carrier:
                with TraceContextTextMapPropagator().extract(carrier):
                    orchestration_result = await self.orchestration.invoke(
                        task=task,
                        runtime=self.runtime,
                    )
            else:
                orchestration_result = await self.orchestration.invoke(
                    task=task,
                    runtime=self.runtime,
                )
            
            # Get the final result
            value = await orchestration_result.get()
            
            # Yield the final result as a stream
            yield f"data: {{'content': '{value}', 'type': 'orchestration_result'}}\n\n"
            
            logger.info("Orchestration completed successfully")
            
        except Exception as e:
            logger.error(f"Error during orchestration: {e}")
            yield f"data: {{'content': 'Error during orchestration: {str(e)}', 'type': 'error'}}\n\n"
    
    async def get_agent_info(self) -> Dict:
        """Get information about the initialized agents"""
        agent_info = {}
        for agent_id, agent in self.agents.items():
            definition = self.agent_definitions.get(agent_id)
            if definition:
                agent_info[agent_id] = {
                    "name": definition.name,
                    "model": definition.model,
                    "description": getattr(definition, 'description', 'No description available'),
                    "instructions": definition.instructions
                }
        return agent_info
    
    async def cleanup(self):
        """Clean up resources"""
        try:
            if self.runtime:
                await self.runtime.stop_when_idle()
                logger.info("Runtime stopped")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
