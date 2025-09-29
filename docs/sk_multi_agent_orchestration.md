# Semantic Kernel Multi-Agent Orchestration Guide

This document explains how to use the new Semantic Kernel (SK) Multi-Agent Orchestration feature in your AI Agents application.

## Overview

The SK Multi-Agent Orchestration feature allows you to coordinate multiple Azure AI Agents using Semantic Kernel's Magentic Orchestrator. This enables sophisticated multi-agent conversations where different agents can collaborate to answer complex queries.

## Features

- **Single Agent Mode**: Traditional single-agent interaction (default)
- **Multi-Agent Orchestration**: Coordinate multiple agents using Semantic Kernel
- **Dynamic Agent Management**: Initialize, manage, and cleanup agent orchestrations
- **Real-time Status Monitoring**: View orchestration status and agent information
- **Interactive UI**: Switch between modes using the web interface

## Prerequisites

1. **Azure AI Project**: Set up an Azure AI Project with multiple agents
2. **Agent IDs**: Have multiple Azure AI Agent IDs ready for orchestration
3. **Environment Variables**: Configure required environment variables
4. **Dependencies**: Ensure Semantic Kernel packages are installed

## Environment Configuration

Add the following environment variable to your `.env` file:

```bash
# Azure AI Agent Endpoint for SK Orchestration
AZURE_AI_AGENT_ENDPOINT=https://your-ai-project-endpoint.cognitiveservices.azure.com
```

This should typically be the same as your `AZURE_EXISTING_AIPROJECT_ENDPOINT`.

## How to Use

### Step 1: Access the Web Interface

1. Start your application: `python -m uvicorn src.api.main:create_app --factory --reload`
2. Open your browser to `http://localhost:8000`
3. You'll see the Agent Mode Configuration panel at the top of the page

### Step 2: Enable Multi-Agent Orchestration

1. Toggle the "Enable Multi-Agent Orchestration" switch
2. The interface will switch from Single Agent Mode to Multi-Agent Mode

### Step 3: Configure Agent IDs

1. In the "Agent IDs" field, enter comma-separated agent IDs
2. Example: `asst_gWrKpj2St0nmQutGzEVQIKp7, asst_S8sr9iAt4DKc0dIkBiOsUu3Y`
3. Click "Initialize Orchestration"

### Step 4: Monitor Status

Once initialized, you'll see:
- **Status**: Shows if orchestration is initialized
- **Agent Count**: Number of agents in the orchestration
- **Agent IDs**: List of active agent IDs

### Step 5: Send Queries

1. Use the "Query for Multi-Agent Processing" field
2. Enter your query (e.g., "Is there a time in the year with high amount of taxi trips? If so why could that be where there any events that happened?")
3. Click "Send to Orchestration"
4. View the coordinated response from multiple agents

## API Endpoints

The following new API endpoints are available:

### Initialize Orchestration
```http
POST /orchestration/initialize
Content-Type: application/json

{
  "agent_ids": ["asst_123", "asst_456"]
}
```

### Get Orchestration Status
```http
GET /orchestration/status
```

### Send Orchestrated Query
```http
POST /orchestration/chat
Content-Type: application/json

{
  "message": "Your query here"
}
```

### Cleanup Resources
```http
POST /orchestration/cleanup
```

## Example Use Cases

### 1. Research and Analysis
- **Agent 1**: Data analysis specialist
- **Agent 2**: Research specialist
- **Query**: "Analyze the trends in customer behavior and provide research-backed recommendations"

### 2. Technical Support
- **Agent 1**: Hardware specialist
- **Agent 2**: Software specialist
- **Query**: "My computer is running slowly, what could be the issue?"

### 3. Content Creation
- **Agent 1**: Writing specialist
- **Agent 2**: Technical reviewer
- **Query**: "Create a technical blog post about machine learning best practices"

## Architecture Details

### Components

1. **SKOrchestrationService**: Core orchestration service using Semantic Kernel
2. **StandardMagenticManager**: Manages agent coordination
3. **InProcessRuntime**: Handles agent execution runtime
4. **OrchestrationPanel**: React component for UI interaction

### Flow

1. **Initialization**: Creates AzureAIAgent instances for each agent ID
2. **Orchestration Setup**: Configures Magentic Orchestration with all agents
3. **Query Processing**: Routes queries through the orchestration manager
4. **Response Coordination**: Collects and coordinates responses from multiple agents
5. **Result Delivery**: Returns the final orchestrated result

## Troubleshooting

### Common Issues

1. **Agent Not Found**
   - Verify agent IDs are correct
   - Ensure agents exist in your Azure AI Project
   - Check endpoint configuration

2. **Authentication Errors**
   - Verify Azure credentials are properly configured
   - Check DefaultAzureCredential setup
   - Ensure proper permissions for agent access

3. **Orchestration Initialization Fails**
   - Check that AZURE_AI_AGENT_ENDPOINT is set correctly
   - Verify network connectivity to Azure
   - Review application logs for detailed error messages

4. **UI Not Updating**
   - Refresh the browser
   - Check browser console for JavaScript errors
   - Verify API endpoints are responding

### Debugging

Enable detailed logging by checking the application logs. The orchestration service logs important events:

- Agent initialization
- Orchestration setup
- Query processing
- Error conditions

## Best Practices

1. **Agent Selection**: Choose agents with complementary capabilities
2. **Query Design**: Structure queries to benefit from multi-agent collaboration
3. **Resource Management**: Use the cleanup function when switching configurations
4. **Error Handling**: Monitor status and handle initialization errors gracefully
5. **Performance**: Consider the number of agents vs. response time trade-offs

## Migration from Single Agent

If you're upgrading from a single-agent setup:

1. Your existing single-agent functionality remains unchanged
2. Multi-agent mode is opt-in via the UI toggle
3. No breaking changes to existing API endpoints
4. Environment variables are backward compatible

## Support

For issues or questions:
1. Check the application logs for error details
2. Verify environment configuration
3. Test with single agents first before orchestration
4. Review Azure AI Project agent configurations