import React, { useState, useEffect } from 'react';
import {
  Button,
  Card,
  CardHeader,
  Input,
  Field,
  Switch,
  Spinner,
  Body1,
  Title3,
  Caption1,
  MessageBar,
} from '@fluentui/react-components';
import { ChatRegular, SettingsRegular, DeleteRegular } from '@fluentui/react-icons';
import styles from './OrchestrationPanel.module.css';

interface OrchestrationPanelProps {
  agentDetails: any;
}

interface OrchestrationStatus {
  status: string;
  orchestration_info: {
    agent_count: number;
    agent_ids: string[];
    endpoint: string;
    status: string;
  };
}

interface OrchestrationResult {
  status: string;
  orchestration_result: {
    result: string;
    status: string;
    agents_used: string[];
    query: string;
  };
}

export const OrchestrationPanel: React.FC<OrchestrationPanelProps> = ({ agentDetails }) => {
  const [isOrchestrationMode, setIsOrchestrationMode] = useState(false);
  const [agentIds, setAgentIds] = useState<string>('');
  const [orchestrationStatus, setOrchestrationStatus] = useState<OrchestrationStatus | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [message, setMessage] = useState('');
  const [orchestrationResult, setOrchestrationResult] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Load orchestration status on component mount
  useEffect(() => {
    if (isOrchestrationMode) {
      checkOrchestrationStatus();
    }
  }, [isOrchestrationMode]);

  const checkOrchestrationStatus = async () => {
    try {
      const response = await fetch('/orchestration/status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setOrchestrationStatus(data);
        if (data.orchestration_info.agent_ids.length > 0) {
          setAgentIds(data.orchestration_info.agent_ids.join(', '));
        }
      }
    } catch (err) {
      console.error('Error checking orchestration status:', err);
    }
  };

  const initializeOrchestration = async () => {
    if (!agentIds.trim()) {
      setError('Please enter at least one agent ID');
      return;
    }

    const agentIdList = agentIds.split(',').map(id => id.trim()).filter(id => id);
    
    if (agentIdList.length === 0) {
      setError('Please enter valid agent IDs');
      return;
    }

    setIsInitializing(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/orchestration/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          agent_ids: agentIdList
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setOrchestrationStatus({
          status: 'success',
          orchestration_info: data.agent_info
        });
        setSuccess(`Successfully initialized orchestration with ${agentIdList.length} agents`);
      } else {
        const errorData = await response.json();
        setError(`Failed to initialize orchestration: ${errorData.detail}`);
      }
    } catch (err) {
      setError(`Error initializing orchestration: ${err}`);
    } finally {
      setIsInitializing(false);
    }
  };

  const processOrchestrationQuery = async () => {
    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    if (!orchestrationStatus || orchestrationStatus.orchestration_info.status !== 'initialized') {
      setError('Orchestration is not initialized. Please initialize it first.');
      return;
    }

    setIsProcessing(true);
    setError('');
    setOrchestrationResult('');

    try {
      const response = await fetch('/orchestration/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: message
        }),
      });

      if (response.ok) {
        const data: OrchestrationResult = await response.json();
        setOrchestrationResult(data.orchestration_result.result);
        setSuccess(`Query processed using ${data.orchestration_result.agents_used.length} agents`);
      } else {
        const errorData = await response.json();
        setError(`Failed to process query: ${errorData.detail}`);
      }
    } catch (err) {
      setError(`Error processing query: ${err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const cleanupOrchestration = async () => {
    try {
      const response = await fetch('/orchestration/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        setOrchestrationStatus(null);
        setOrchestrationResult('');
        setSuccess('Orchestration resources cleaned up successfully');
      } else {
        const errorData = await response.json();
        setError(`Failed to cleanup orchestration: ${errorData.detail}`);
      }
    } catch (err) {
      setError(`Error cleaning up orchestration: ${err}`);
    }
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <CardHeader>
          <Title3>
            <ChatRegular className={styles.icon} />
            Agent Mode Configuration
          </Title3>
        </CardHeader>
        <div className={styles.cardBody}>
          <Field label="Enable Multi-Agent Orchestration">
            <Switch
              checked={isOrchestrationMode}
              onChange={(_, data) => setIsOrchestrationMode(data.checked)}
            />
          </Field>

          {error && (
            <MessageBar className={styles.messageBar}>
              {error}
            </MessageBar>
          )}

          {success && (
            <MessageBar className={styles.messageBar}>
              {success}
            </MessageBar>
          )}

          {!isOrchestrationMode && (
            <div className={styles.singleAgentInfo}>
              <Body1>
                <strong>Single Agent Mode</strong>
              </Body1>
              <Caption1>
                Currently using: {agentDetails.name} ({agentDetails.id})
              </Caption1>
            </div>
          )}

          {isOrchestrationMode && (
            <div className={styles.orchestrationControls}>
              <Field label="Agent IDs (comma-separated)">
                <Input
                  value={agentIds}
                  onChange={(_, data) => setAgentIds(data.value)}
                  placeholder="asst_123, asst_456, asst_789"
                  className={styles.agentIdsInput}
                />
              </Field>

              <div className={styles.buttonGroup}>
                <Button
                  appearance="primary"
                  onClick={initializeOrchestration}
                  disabled={isInitializing}
                  icon={isInitializing ? <Spinner size="tiny" /> : <SettingsRegular />}
                >
                  {isInitializing ? 'Initializing...' : 'Initialize Orchestration'}
                </Button>

                {orchestrationStatus && (
                  <Button
                    appearance="subtle"
                    onClick={cleanupOrchestration}
                    icon={<DeleteRegular />}
                  >
                    Cleanup
                  </Button>
                )}
              </div>

              {orchestrationStatus && (
                <div className={styles.statusInfo}>
                  <Body1><strong>Orchestration Status:</strong></Body1>
                  <Caption1>
                    Status: {orchestrationStatus.orchestration_info.status}<br />
                    Agents: {orchestrationStatus.orchestration_info.agent_count}<br />
                    Agent IDs: {orchestrationStatus.orchestration_info.agent_ids.join(', ')}
                  </Caption1>
                </div>
              )}

              {orchestrationStatus && orchestrationStatus.orchestration_info.status === 'initialized' && (
                <div className={styles.querySection}>
                  <Field label="Query for Multi-Agent Processing">
                    <Input
                      value={message}
                      onChange={(_, data) => setMessage(data.value)}
                      placeholder="Enter your query here..."
                      className={styles.messageInput}
                    />
                  </Field>

                  <Button
                    appearance="primary"
                    onClick={processOrchestrationQuery}
                    disabled={isProcessing}
                    icon={isProcessing ? <Spinner size="tiny" /> : <ChatRegular />}
                  >
                    {isProcessing ? 'Processing...' : 'Send to Orchestration'}
                  </Button>

                  {orchestrationResult && (
                    <div className={styles.result}>
                      <Body1><strong>Orchestration Result:</strong></Body1>
                      <div className={styles.resultContent}>
                        {orchestrationResult}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};