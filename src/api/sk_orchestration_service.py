"""
Semantic Kernel Multi-Agent Orchestration Service

This module handles the orchestration of multiple Azure AI agents using 
Semantic Kernel's Magentic Orchestrator for coordinated multi-agent conversations.
"""

import asyncio
import logging
import os
from typing import List, Optional, Any, Dict
from azure.identity import DefaultAzureCredential

# Semantic Kernel imports for Magentic Orchestration
from semantic_kernel.agents import (
    AzureAIAgent, 
    StandardMagenticManager, 
    MagenticOrchestration
)
from semantic_kernel.agents.runtime import InProcessRuntime
from semantic_kernel.connectors.ai.open_ai import AzureChatCompletion
from azure.ai.inference.aio import ChatCompletionsClient
from semantic_kernel.contents import ChatMessageContent

logger = logging.getLogger(__name__)

class SKOrchestrationService:
    """Semantic Kernel Orchestration Service for multi-agent coordination."""
    
    def __init__(self):
        """Initialize the orchestration service with Azure credentials."""
        self.credential = DefaultAzureCredential(exclude_shared_token_cache_credential=True)
        self.endpoint = os.getenv("AZURE_EXISTING_AIPROJECT_ENDPOINT") or os.getenv("AZURE_AI_AGENT_ENDPOINT")
        self.ai_agent_client = None
        self.agents = {}
        self.orchestration = None
        self.runtime = None
        
        if not self.endpoint:
            raise ValueError("AZURE_EXISTING_AIPROJECT_ENDPOINT or AZURE_AI_AGENT_ENDPOINT environment variable is required")
    
    async def initialize(self, agent_ids: List[str]) -> None:
        """
        Initialize the orchestration service with specified agent IDs.
        
        Args:
            agent_ids: List of Azure AI agent IDs to orchestrate
        """
        try:
            # Create Azure AI Agent client using the correct pattern
            self.ai_agent_client = AzureAIAgent.create_client(
                credential=self.credential,
                endpoint=self.endpoint
            )
            
            # Initialize agents by fetching their definitions and creating AzureAIAgent instances
            for agent_id in agent_ids:
                try:
                    # Get the agent definition
                    agent_def = await self.ai_agent_client.agents.get_agent(agent_id)
                    
                    # Create AzureAIAgent instance
                    azure_ai_agent = AzureAIAgent(
                        client=self.ai_agent_client,
                        definition=agent_def
                    )
                    
                    self.agents[agent_id] = azure_ai_agent
                    logger.info(f"Initialized agent: {agent_id} - {agent_def.name}")
                except Exception as e:
                    logger.error(f"Failed to initialize agent {agent_id}: {str(e)}")
                    raise
            
            logger.info(f"SK Orchestration service initialized successfully with {len(self.agents)} agents")
            
        except Exception as e:
            logger.error(f"Failed to initialize SK orchestration service: {str(e)}")
            raise
    
    async def cleanup_active_runs(self) -> None:
        """Clean up any active runs on agent threads."""
        if not self.ai_agent_client or not self.agents:
            return
            
        try:
            for agent_id, agent in self.agents.items():
                try:
                    # Get the agent's thread ID if it exists
                    if hasattr(agent, '_agent_thread') and agent._agent_thread and hasattr(agent._agent_thread, 'id'):
                        thread_id = agent._agent_thread.id
                        
                        # List any active runs on this thread
                        runs = await self.ai_agent_client.agents.runs.list(thread_id=thread_id)
                        
                        # Cancel any active runs
                        for run in runs.data:
                            if run.status in ['queued', 'in_progress', 'requires_action']:
                                logger.info(f"Cancelling active run {run.id} on thread {thread_id}")
                                try:
                                    await self.ai_agent_client.agents.runs.cancel(thread_id=thread_id, run_id=run.id)
                                except Exception as cancel_error:
                                    logger.warning(f"Failed to cancel run {run.id}: {cancel_error}")
                                    
                except Exception as agent_error:
                    logger.warning(f"Error cleaning up runs for agent {agent_id}: {agent_error}")
                    continue
                    
        except Exception as e:
            logger.warning(f"Error during active runs cleanup: {e}")

    async def process_query(self, query: str) -> Dict[str, Any]:
        """
        Process a query using Semantic Kernel Magentic Orchestration.
        
        Args:
            query: The user query to process
            
        Returns:
            Dictionary containing the orchestration result and metadata
        """
        if not self.agents:
            raise RuntimeError("Orchestration service not initialized")
        
        try:
            logger.info(f"Processing orchestrated query: {query}")
            
            # First, cleanup any active runs to prevent thread conflicts
            await self.cleanup_active_runs()
            
            # Get the list of AzureAIAgent instances (they are already created in initialize)
            sk_agents = list(self.agents.values())
            
            if len(sk_agents) < 1:
                raise RuntimeError("No valid SK agents available")
            
            # Create Azure OpenAI chat completion service using the same pattern as your working sample
            chat_completion = AzureChatCompletion(
                deployment_name="gpt-4.1",  # Use the deployment name from your sample
                endpoint=os.getenv("AZURE_OPENAI_ENDPOINT", "https://foundryuaenorth.cognitiveservices.azure.com/"),
                api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            )
            
            # Create the Magentic Manager
            manager = StandardMagenticManager(chat_completion_service=chat_completion)
            
            # Agent response callback for logging
            def agent_response_callback(message: ChatMessageContent) -> None:
                logger.info(f"**{message.name}**\\n{message.content}")
            
            # Create the Magentic Orchestration
            orchestration = MagenticOrchestration(
                members=sk_agents,
                manager=manager,
                agent_response_callback=agent_response_callback,
            )
            
            # Create and start runtime
            self.runtime = InProcessRuntime()
            self.runtime.start()
            
            # Invoke the orchestration with proper parameters
            logger.info("Invoking Magentic Orchestration...")
            orchestration_result = await orchestration.invoke(
                task=query,  # Use 'task' parameter, not 'query'
                runtime=self.runtime,
            )
            
            # Get the actual result
            result_value = await orchestration_result.get()
            result_text = str(result_value) if result_value else "No response from orchestration"
            
            # Stop the runtime when idle
            await self.runtime.stop_when_idle()
            
            logger.info(f"Orchestration completed: {result_text[:100]}...")
            
            return {
                "result": result_text,
                "status": "success",
                "agents_used": list(self.agents.keys()),
                "query": query,
                "orchestration_type": "MagenticOrchestration"
            }
            
        except Exception as e:
            logger.error(f"Error processing query with SK orchestration: {str(e)}")
            
            # Try to cleanup runtime if there was an error
            if self.runtime:
                try:
                    await self.runtime.stop_when_idle()
                except Exception as cleanup_error:
                    logger.warning(f"Error cleaning up runtime after failure: {cleanup_error}")
                finally:
                    self.runtime = None
            
            return {
                "result": f"Error processing query: {str(e)}",
                "status": "error",
                "agents_used": list(self.agents.keys()),
                "query": query
            }
    
    async def cleanup(self) -> None:
        """Clean up resources."""
        try:
            # Stop runtime if it exists
            if self.runtime:
                try:
                    await self.runtime.stop_when_idle()
                    logger.info("Runtime stopped successfully")
                except Exception as runtime_error:
                    logger.warning(f"Error stopping runtime: {runtime_error}")
                finally:
                    self.runtime = None
            
            # Clean up any active runs
            await self.cleanup_active_runs()
            
            # Close agent client if it exists
            if self.ai_agent_client:
                try:
                    await self.ai_agent_client.close()
                    logger.info("Agent client closed successfully")
                except Exception as client_error:
                    logger.warning(f"Error closing agent client: {client_error}")
                finally:
                    self.ai_agent_client = None
            
            self.agents.clear()
            self.orchestration = None
            
        except Exception as e:
            logger.error(f"Error during cleanup: {str(e)}")
    
    def get_agent_info(self) -> Dict[str, Any]:
        """Get information about registered agents."""
        agent_names = []
        for agent in self.agents.values():
            # AzureAIAgent instances have a definition attribute with name
            name = getattr(agent.definition, 'name', 'Unknown') if hasattr(agent, 'definition') else 'Unknown'
            agent_names.append(name)
        
        return {
            "agent_count": len(self.agents),
            "agent_ids": list(self.agents.keys()),
            "agent_names": agent_names,
            "endpoint": self.endpoint,
            "status": "initialized" if self.agents else "not_initialized"
        }

# Global instance for the service
_orchestration_service: Optional[SKOrchestrationService] = None

async def get_orchestration_service() -> SKOrchestrationService:
    """Get or create the global orchestration service instance."""
    global _orchestration_service
    
    if _orchestration_service is None:
        _orchestration_service = SKOrchestrationService()
    
    return _orchestration_service

async def initialize_orchestration(agent_ids: List[str]) -> None:
    """Initialize the orchestration service with agent IDs."""
    service = await get_orchestration_service()
    await service.initialize(agent_ids)

async def process_orchestrated_query(query: str) -> Dict[str, Any]:
    """Process a query using orchestration."""
    service = await get_orchestration_service()
    return await service.process_query(query)

async def cleanup_orchestration() -> None:
    """Cleanup orchestration resources."""
    global _orchestration_service
    if _orchestration_service:
        await _orchestration_service.cleanup()
        _orchestration_service = None