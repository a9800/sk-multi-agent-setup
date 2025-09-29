import { ReactNode, useState, useMemo, useEffect } from "react";
import {
  Body1,
  Button,
  Caption1,
  Spinner,
  Title3,
} from "@fluentui/react-components";
import { ChatRegular, MoreHorizontalRegular } from "@fluentui/react-icons";
import clsx from "clsx";

import { AgentIcon } from "./AgentIcon";
import { SettingsPanel } from "../core/SettingsPanel";
import { AgentPreviewChatBot } from "./AgentPreviewChatBot";
import { MenuButton } from "../core/MenuButton/MenuButton";
import { IChatItem } from "./chatbot/types";
import { Waves } from "./Waves";
import { BuiltWithBadge } from "./BuiltWithBadge";

import styles from "./AgentPreview.module.css";

interface IAgent {
  id: string;
  object: string;
  created_at: number;
  name: string;
  description?: string | null;
  model: string;
  instructions?: string;
  tools?: Array<{ type: string }>;
  top_p?: number;
  temperature?: number;
  tool_resources?: {
    file_search?: {
      vector_store_ids?: string[];
    };
    [key: string]: any;
  };
  metadata?: Record<string, any>;
  response_format?: "auto" | string;
}

interface IAgentPreviewProps {
  resourceId: string;
  agentDetails: IAgent;
}

interface IAnnotation {
  file_name?: string;
  text: string;
  start_index: number;
  end_index: number;
}

const preprocessContent = (
  content: string,
  annotations?: IAnnotation[]
): string => {
  if (annotations) {
    // Process annotations in reverse order so that the indexes remain valid
    annotations
      .slice()
      .reverse()
      .forEach((annotation) => {
        // If there's a file_name, show it (wrapped in brackets), otherwise fall back to annotation.text.
        const linkText = annotation.file_name
          ? `[${annotation.file_name}]`
          : annotation.text;

        content =
          content.slice(0, annotation.start_index) +
          linkText +
          content.slice(annotation.end_index);
      });
  }
  return content;
};

export function AgentPreview({ agentDetails }: IAgentPreviewProps): ReactNode {
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [messageList, setMessageList] = useState<IChatItem[]>([]);
  const [isResponding, setIsResponding] = useState(false);
  const [isLoadingChatHistory, setIsLoadingChatHistory] = useState(true);
  
  // Orchestration state
  const [isOrchestrationMode, setIsOrchestrationMode] = useState(false);
  const [orchestrationInitialized, setOrchestrationInitialized] = useState(false);
  const [orchestrationAgentIds, setOrchestrationAgentIds] = useState("asst_zukqFOaveIg3MnsZKVNTlOYz,asst_4pgepxxILUlOPYhfJlwdIZtJ,asst_QodeNV9JgOLhp2nEG6pDFbLN");
  const [showAgentThinking, setShowAgentThinking] = useState(false);
  const [agentThinkingMessages, setAgentThinkingMessages] = useState<any[]>([]);
  const [isPollingThinking, setIsPollingThinking] = useState(false);

  const loadChatHistory = async () => {
    try {
      const response = await fetch("/chat/history", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (response.ok) {
        const json_response: Array<{
          role: string;
          content: string;
          created_at: string;
          annotations?: IAnnotation[];
        }> = await response.json();

        // It's generally better to build the new list and set state once
        const historyMessages: IChatItem[] = [];
        const reversedResponse = [...json_response].reverse();

        for (const entry of reversedResponse) {
          if (entry.role === "user") {
            historyMessages.push({
              id: crypto.randomUUID(),
              content: entry.content,
              role: "user",
              more: { time: entry.created_at }, // Or use timestamp from history if available
            });
          } else {
            historyMessages.push({
              id: `assistant-hist-${Date.now()}-${Math.random()}`, // Ensure unique ID
              content: preprocessContent(entry.content, entry.annotations),
              role: "assistant", // Assuming 'assistant' role for non-user
              isAnswer: true, // Assuming this property for assistant messages
              more: { time: entry.created_at }, // Or use timestamp from history if available
              // annotations: entry.annotations, // If you plan to use annotations
            });
          }
        }
        setMessageList((prev) => [...historyMessages, ...prev]); // Prepend history
      } else {
        const errorChatItem = createAssistantMessageDiv(); // This will add an empty message first
        appendAssistantMessage(
          errorChatItem,
          "Error occurs while loading chat history!",
          false
        );
      }
      setIsLoadingChatHistory(false);
    } catch (error) {
      console.error("Failed to load chat history:", error);
      const errorChatItem = createAssistantMessageDiv();
      appendAssistantMessage(
        errorChatItem,
        "Error occurs while loading chat history!",
        false
      );
      setIsLoadingChatHistory(false);
    }
  };

  useEffect(() => {
    loadChatHistory();
  }, []);

  const handleSettingsPanelOpenChange = (isOpen: boolean) => {
    setIsSettingsPanelOpen(isOpen);
  };

  // Orchestration status fetching
  const fetchOrchestrationStatus = async () => {
    try {
      const response = await fetch('/orchestration/status');
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setOrchestrationInitialized(data.orchestration_info?.status === 'initialized');
        }
      }
    } catch (error) {
      console.error('Error fetching orchestration status:', error);
    }
  };

  // Orchestration management functions
  const handleOrchestrationModeChange = (enabled: boolean) => {
    console.log(`[OrchestrationToggle] Changing orchestration mode to: ${enabled}`);
    setIsOrchestrationMode(enabled);
    if (!enabled) {
      // Clear orchestration state when disabling
      console.log("[OrchestrationToggle] Disabling orchestration, clearing state");
      setOrchestrationInitialized(false);
    } else {
      // Check current orchestration status when enabling
      console.log("[OrchestrationToggle] Enabling orchestration, checking status");
      fetchOrchestrationStatus();
    }
  };

  const handleShowAgentThinkingChange = (enabled: boolean) => {
    console.log(`[AgentThinking] Changing show agent thinking to: ${enabled}`);
    setShowAgentThinking(enabled);
  };

  // Helper function to get display name based on orchestration mode
  const getDisplayName = () => {
    return isOrchestrationMode && orchestrationInitialized ? "Multi-Agent" : agentDetails.name;
  };

  const handleInitializeOrchestration = async () => {
    try {
      const response = await fetch('/orchestration/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_ids: orchestrationAgentIds.split(',').map(id => id.trim()) })
      });
      if (response.ok) {
        await fetchOrchestrationStatus();
      }
    } catch (error) {
      console.error('Error initializing orchestration:', error);
    }
  };

  const handleCleanupOrchestration = async () => {
    try {
      const response = await fetch('/orchestration/cleanup', { method: 'POST' });
      if (response.ok) {
        setOrchestrationInitialized(false);
      }
    } catch (error) {
      console.error('Error cleaning up orchestration:', error);
    }
  };

  // Agent thinking functions
  const fetchAgentThinking = async () => {
    try {
      const response = await fetch('/orchestration/agent-thinking');
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setAgentThinkingMessages(data.messages || []);
        }
      }
    } catch (error) {
      console.error('Error fetching agent thinking:', error);
    }
  };

  const startAgentThinkingPolling = () => {
    if (showAgentThinking && isOrchestrationMode && !isPollingThinking) {
      setIsPollingThinking(true);
      const pollInterval = setInterval(async () => {
        await fetchAgentThinking();
      }, 1000); // Poll every second during orchestration

      // Store interval ID for cleanup
      (window as any).agentThinkingInterval = pollInterval;
    }
  };

  const stopAgentThinkingPolling = () => {
    setIsPollingThinking(false);
    if ((window as any).agentThinkingInterval) {
      clearInterval((window as any).agentThinkingInterval);
      (window as any).agentThinkingInterval = null;
    }
  };

  const stopRespondingAndPolling = () => {
    setIsResponding(false);
    stopAgentThinkingPolling();
  };

  // Check orchestration status on component mount
  useEffect(() => {
    if (isOrchestrationMode) {
      fetchOrchestrationStatus();
    }
  }, [isOrchestrationMode]);

  // Cleanup polling on component unmount
  useEffect(() => {
    return () => {
      stopAgentThinkingPolling();
    };
  }, []);

  const newThread = () => {
    setMessageList([]);
    deleteAllCookies();
  };

  const deleteAllCookies = (): void => {
    document.cookie.split(";").forEach((cookieStr: string) => {
      const trimmedCookieStr = cookieStr.trim();
      const eqPos = trimmedCookieStr.indexOf("=");
      const name =
        eqPos > -1 ? trimmedCookieStr.substring(0, eqPos) : trimmedCookieStr;
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    });
  };

  const onSend = async (message: string) => {
    console.log(`[ChatClient] onSend called - orchestrationMode: ${isOrchestrationMode}, initialized: ${orchestrationInitialized}`);
    
    const userMessage: IChatItem = {
      id: `user-${Date.now()}`,
      content: message,
      role: "user",
      more: { time: new Date().toISOString() },
    };

    setMessageList((prev) => [...prev, userMessage]);

    try {
      // Double-check orchestration status if orchestration mode is enabled
      let useOrchestration = isOrchestrationMode && orchestrationInitialized;
      
      if (isOrchestrationMode && !orchestrationInitialized) {
        console.log("[ChatClient] Orchestration mode enabled but not initialized, checking status...");
        
        // Quick status check to see if orchestration is actually initialized
        try {
          const statusResponse = await fetch('/orchestration/status');
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            if (statusData.status === 'success' && statusData.orchestration_info?.status === 'initialized') {
              console.log("[ChatClient] Orchestration is actually initialized, updating state and using orchestration");
              setOrchestrationInitialized(true);
              useOrchestration = true;
            }
          }
        } catch (statusError) {
          console.error("[ChatClient] Error checking orchestration status:", statusError);
        }
      }

      // Choose endpoint based on orchestration mode AND initialization status
      const endpoint = useOrchestration ? "/orchestration/chat" : "/chat";
      const postData = useOrchestration ? { query: message } : { message: message };
      
      console.log(`[ChatClient] Using endpoint: ${endpoint} (orchestrationMode: ${isOrchestrationMode}, initialized: ${orchestrationInitialized}, useOrchestration: ${useOrchestration})`);
      
      setIsResponding(true);
      
      // Start agent thinking polling if enabled and using orchestration
      if (useOrchestration && showAgentThinking) {
        startAgentThinkingPolling();
      }
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postData),
        credentials: "include", // <--- allow cookies to be included
      });

            // Log out the response status in case there's an error
      console.log(
        "[ChatClient] Response status:",
        response.status,
        response.statusText
      );

      // If server returned e.g. 400 or 500, that's not an exception, but we can check manually:
      if (!response.ok) {
        console.error(
          "[ChatClient] Response not OK:",
          response.status,
          response.statusText
        );
        return;
      }

      // Handle different response formats based on endpoint
      if (useOrchestration) {
        // Orchestration endpoint returns JSON
        console.log("[ChatClient] Handling JSON response from orchestration endpoint...");
        const jsonResponse = await response.json();
        console.log("[ChatClient] Orchestration response:", jsonResponse);
        
        if (jsonResponse.status === 'success' && jsonResponse.orchestration_result) {
          const assistantMessage: IChatItem = {
            id: `assistant-${Date.now()}`,
            content: jsonResponse.orchestration_result.result,
            role: "assistant",
            isAnswer: true,
            more: { time: new Date().toISOString() },
          };
          setMessageList((prev) => [...prev, assistantMessage]);
        } else {
          // Handle error case
          const errorMessage: IChatItem = {
            id: `error-${Date.now()}`,
            content: jsonResponse.error || "An error occurred during orchestration",
            role: "assistant",
            isAnswer: true,
            more: { time: new Date().toISOString() },
          };
          setMessageList((prev) => [...prev, errorMessage]);
        }
        stopRespondingAndPolling();
      } else {
        // Regular chat endpoint returns streaming response
        if (!response.body) {
          throw new Error(
            "ReadableStream not supported or response.body is null"
          );
        }

        console.log("[ChatClient] Starting to handle streaming response...");
        handleMessages(response.body);
      }
    } catch (error: any) {
      stopRespondingAndPolling();
      if (error.name === "AbortError") {
        console.log("[ChatClient] Fetch request aborted by user.");
      } else {
        console.error("[ChatClient] Fetch failed:", error);
      }
    }
  };

  const handleMessages = (
    stream: ReadableStream<Uint8Array<ArrayBufferLike>>
  ) => {
    let chatItem: IChatItem | null = null;
    let accumulatedContent = "";
    let isStreaming = true;
    let buffer = "";
    let annotations: IAnnotation[] = [];

    // Create a reader for the SSE stream
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    const readStream = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("[ChatClient] SSE stream ended by server.");
          break;
        }

        // Convert the incoming Uint8Array to text
        const textChunk = decoder.decode(value, { stream: true });
        console.log("[ChatClient] Raw chunk from stream:", textChunk);

        buffer += textChunk;
        let boundary = buffer.indexOf("\n");

        // We process line-by-line.
        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 1);

          console.log("[ChatClient] SSE line:", chunk); // log each line we extract

          if (chunk.startsWith("data: ")) {
            // Attempt to parse JSON
            const jsonStr = chunk.slice(6);
            let data;
            try {
              data = JSON.parse(jsonStr);
            } catch (err) {
              console.error("[ChatClient] Failed to parse JSON:", jsonStr, err);
              boundary = buffer.indexOf("\n");
              continue;
            }

            console.log("[ChatClient] Parsed SSE event:", data);

            if (data.error) {
              if (!chatItem) {
                chatItem = createAssistantMessageDiv();
                console.log(
                  "[ChatClient] Created new messageDiv for assistant."
                );
              }

              stopRespondingAndPolling();
              appendAssistantMessage(
                chatItem,
                data.error.message || "An error occurred.",
                false
              );
              return;
            }

            // Check the data type to decide how to update the UI
            if (data.type === "stream_end") {
              // End of the stream
              console.log("[ChatClient] Stream end marker received.");
              stopRespondingAndPolling();
              break;
            } else if (data.type === "thread_run") {
              // Log the run status info
              console.log("[ChatClient] Run status info:", data.content);
            } else {
              // If we have no messageDiv yet, create one
              if (!chatItem) {
                chatItem = createAssistantMessageDiv();
                console.log(
                  "[ChatClient] Created new messageDiv for assistant."
                );
              }

              if (data.type === "completed_message") {
                clearAssistantMessage(chatItem);
                accumulatedContent = data.content;
                annotations = data.annotations;
                isStreaming = false;
                console.log(
                  "[ChatClient] Received completed message:",
                  accumulatedContent
                );

                stopRespondingAndPolling();
              } else {
                accumulatedContent += data.content;
                console.log(
                  "[ChatClient] Received streaming chunk:",
                  data.content
                );
              }

              // Update the UI with the accumulated content
              appendAssistantMessage(
                chatItem,
                accumulatedContent,
                isStreaming,
                annotations
              );
            }
          }

          boundary = buffer.indexOf("\n");
        }
      }
    };

    // Catch errors from the stream reading process
    readStream().catch((error) => {
      console.error("[ChatClient] Stream reading failed:", error);
    });
  };

  const createAssistantMessageDiv: () => IChatItem = () => {
    var item = {
      id: crypto.randomUUID(),
      content: "",
      isAnswer: true,
      more: { time: new Date().toISOString() },
    };
    setMessageList((prev) => [...prev, item]);
    return item;
  };
  const appendAssistantMessage = (
    chatItem: IChatItem,
    accumulatedContent: string,
    isStreaming: boolean,
    annotations?: IAnnotation[]
  ) => {
    try {
      // Preprocess content to convert citations to links using the updated annotation data
      // Convert the accumulated content to HTML using markdown-it
      const preprocessedContent = preprocessContent(
        accumulatedContent,
        annotations
      ); 
      let htmlContent = preprocessedContent;
      if (!chatItem) {
        throw new Error("Message content div not found in the template.");
      }

      // Set the innerHTML of the message text div to the HTML content
      chatItem.content = htmlContent;
      setMessageList((prev) => {
        return [...prev.slice(0, -1), { ...chatItem }];
      });

      // Use requestAnimationFrame to ensure the DOM has updated before scrolling
      // Only scroll if stop streaming
      if (!isStreaming) {
        requestAnimationFrame(() => {
          const lastChild = document.getElementById(`msg-${chatItem.id}`);
          if (lastChild) {
            lastChild.scrollIntoView({ behavior: "smooth", block: "end" });
          }
        });
      }
    } catch (error) {
      console.error("Error in appendAssistantMessage:", error);
    }
  };

  const clearAssistantMessage = (chatItem: IChatItem) => {
    if (chatItem) {
      chatItem.content = "";
    }
  };
  const menuItems = [
    {
      key: "settings",
      children: "Settings",
      onClick: () => {
        setIsSettingsPanelOpen(true);
      },
    },
    {
      key: "terms",
      children: (
        <a
          className={styles.externalLink}
          href="https://aka.ms/aistudio/terms"
          target="_blank"
          rel="noopener noreferrer"
        >
          Terms of Use
        </a>
      ),
    },
    {
      key: "privacy",
      children: (
        <a
          className={styles.externalLink}
          href="https://go.microsoft.com/fwlink/?linkid=521839"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy
        </a>
      ),
    },
    {
      key: "feedback",
      children: "Send Feedback",
      onClick: () => {
        // Handle send feedback click
        alert("Thank you for your feedback!");
      },
    },
  ];
  const chatContext = useMemo(
    () => ({
      messageList,
      isResponding,
      onSend,
    }),
    [messageList, isResponding]
  );
  const isEmpty = (messageList?.length ?? 0) === 0;

  return (
    <div className={styles.container}>
      <div className={styles.wavesContainer}>
        <Waves paused={!isEmpty} />
      </div>
      <div className={styles.topBar}>
        <div className={styles.leftSection}>
          {agentDetails.name ? (
            <div className={styles.agentIconContainer}>
              <AgentIcon
                alt=""
                iconClassName={styles.agentIcon}
                iconName={agentDetails.metadata?.logo}
              />
              <Body1 as="h1" className={styles.agentName}>
                {getDisplayName()}
              </Body1>
            </div>
          ) : (
            <div className={styles.agentIconContainer}>
              <div
                className={clsx(styles.agentIcon, {
                  [styles.newAgent]: true,
                })}
              />
              <Body1
                as="h1"
                className={clsx(styles.agentName, {
                  [styles.newAgent]: true,
                })}
              >
                Agent Name
              </Body1>
            </div>
          )}
        </div>
        <div className={styles.rightSection}>
          <Button
            appearance="subtle"
            icon={<ChatRegular aria-hidden={true} />}
            onClick={newThread}
          >
            New Chat
          </Button>
          <MenuButton
            menuButtonText=""
            menuItems={menuItems}
            menuButtonProps={{
              appearance: "subtle",
              icon: <MoreHorizontalRegular />,
              "aria-label": "Settings",
            }}
          />
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.chatbot}>
          {isLoadingChatHistory ? (
            <Spinner label={"Loading chat history..."} />
          ) : (
            <>
              {isEmpty && (
                <div className={styles.emptyChatContainer}>
                  <AgentIcon
                    alt=""
                    iconClassName={styles.emptyStateAgentIcon}
                    iconName={agentDetails.metadata?.logo}
                  />
                  <Caption1 className={styles.agentName}>
                    {getDisplayName()}
                  </Caption1>
                  <Title3>How can I help you today?</Title3>
                </div>
              )}
              
              {/* Agent Thinking Display */}
              {showAgentThinking && isOrchestrationMode && agentThinkingMessages.length > 0 && (
                <div style={{ 
                  marginBottom: "16px", 
                  padding: "12px", 
                  backgroundColor: "#f5f5f5", 
                  borderRadius: "8px",
                  border: "1px solid #e0e0e0"
                }}>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "600" }}>
                    🤔 Agent Thinking Process
                  </h4>
                  <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                    {agentThinkingMessages.map((msg, index) => (
                      <div key={index} style={{ 
                        marginBottom: "8px", 
                        padding: "8px", 
                        backgroundColor: "white", 
                        borderRadius: "4px",
                        fontSize: "12px"
                      }}>
                        <strong>{msg.agent_name}:</strong> {msg.content}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <AgentPreviewChatBot
                agentName={getDisplayName()}
                agentLogo={agentDetails.metadata?.logo}
                chatContext={chatContext}
              />
            </>
          )}
        </div>

        <BuiltWithBadge className={styles.builtWithBadge} />
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsPanelOpen}
        onOpenChange={handleSettingsPanelOpenChange}
        isOrchestrationMode={isOrchestrationMode}
        onOrchestrationModeChange={handleOrchestrationModeChange}
        orchestrationAgentIds={orchestrationAgentIds}
        onOrchestrationAgentIdsChange={setOrchestrationAgentIds}
        orchestrationInitialized={orchestrationInitialized}
        onInitializeOrchestration={handleInitializeOrchestration}
        onCleanupOrchestration={handleCleanupOrchestration}
        showAgentThinking={showAgentThinking}
        onShowAgentThinkingChange={handleShowAgentThinkingChange}
        agentDetails={agentDetails}
      />
    </div>
  );
}
