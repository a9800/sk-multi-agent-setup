import type { JSX } from "react";
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Field,
  Switch,
  Input,
  MessageBar,
} from "@fluentui/react-components";
import { Dismiss24Regular, SettingsRegular } from "@fluentui/react-icons";

import styles from "./SettingsPanel.module.css";
import { ThemePicker } from "./theme/ThemePicker";

export interface ISettingsPanelProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  // Multi-agent orchestration props
  isOrchestrationMode: boolean;
  onOrchestrationModeChange: (enabled: boolean) => void;
  orchestrationAgentIds: string;
  onOrchestrationAgentIdsChange: (ids: string) => void;
  orchestrationInitialized: boolean;
  onInitializeOrchestration: () => Promise<void>;
  onCleanupOrchestration: () => Promise<void>;
  showAgentThinking: boolean;
  onShowAgentThinkingChange: (enabled: boolean) => void;
  agentDetails: any;
}

export function SettingsPanel({
  isOpen = false,
  onOpenChange,
  isOrchestrationMode,
  onOrchestrationModeChange,
  orchestrationAgentIds,
  onOrchestrationAgentIdsChange,
  orchestrationInitialized,
  onInitializeOrchestration,
  onCleanupOrchestration,
  showAgentThinking,
  onShowAgentThinkingChange,
  agentDetails,
}: ISettingsPanelProps): JSX.Element {
  return (
    <Drawer
      className={styles.panel}
      onOpenChange={(_, { open }) => {
        onOpenChange(open);
      }}
      open={isOpen}
      position="end"
    >
      <DrawerHeader>
        <DrawerHeaderTitle
          action={
            <div>
              <Button
                appearance="subtle"
                icon={<Dismiss24Regular />}
                onClick={() => {
                  onOpenChange(false);
                }}
              />
            </div>
          }
        >
          Settings
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody className={styles.content}>
        <ThemePicker />
        
        {/* Multi-Agent Orchestration Settings */}
        <div className={styles.section}>
          <h3>Agent Configuration</h3>
          
          <Field label="Enable Multi-Agent Orchestration">
            <Switch
              checked={isOrchestrationMode}
              onChange={(_, data) => onOrchestrationModeChange(data.checked)}
            />
          </Field>

          {!isOrchestrationMode && (
            <div className={styles.singleAgentInfo}>
              <strong>Single Agent Mode</strong>
              <p>Currently using: {agentDetails.name} ({agentDetails.id})</p>
            </div>
          )}

          {isOrchestrationMode && (
            <div className={styles.orchestrationSettings}>
              <Field label="Agent IDs (comma-separated)">
                <Input
                  value={orchestrationAgentIds}
                  onChange={(_, data) => onOrchestrationAgentIdsChange(data.value)}
                  placeholder="asst_123, asst_456, asst_789"
                />
              </Field>

              <Field label="Show Agent Thinking">
                <Switch
                  checked={showAgentThinking}
                  onChange={(_, data) => onShowAgentThinkingChange(data.checked)}
                />
              </Field>
              <p style={{ fontSize: '12px', color: 'var(--colorNeutralForeground3)', margin: '4px 0 16px 0' }}>
                Display what each agent is thinking during the orchestration process
              </p>

              <div className={styles.orchestrationActions}>
                {!orchestrationInitialized ? (
                  <Button
                    appearance="primary"
                    icon={<SettingsRegular />}
                    onClick={onInitializeOrchestration}
                  >
                    Initialize Orchestration
                  </Button>
                ) : (
                  <>
                    <MessageBar>
                      Multi-agent orchestration is active with {orchestrationAgentIds.split(',').length} agents.
                    </MessageBar>
                    <Button
                      appearance="subtle"
                      onClick={onCleanupOrchestration}
                    >
                      Cleanup Orchestration
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </DrawerBody>
    </Drawer>
  );
}
