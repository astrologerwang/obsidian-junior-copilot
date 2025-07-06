import { getCurrentProject, setCurrentProject, setProjectLoading, useChainType } from "@/aiParams";
import { ProjectContextCache } from "@/cache/projectContextCache";
import { ChainType } from "@/chainFactory";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { logError } from "@/logger";
import { useIsPlusUser } from "@/plusUtils";
import VectorStoreManager from "@/search/vectorStoreManager";
import { useSettingsValue } from "@/settings/model";
import { Docs4LLMParser } from "@/tools/FileParserManager";
import { isRateLimitError } from "@/utils/rateLimitUtils";
import { Download, History, MessageCircleCode, MessageCirclePlus } from "lucide-react";
import { Notice } from "obsidian";
import React from "react";

export async function refreshVaultIndex() {
    try {
        await VectorStoreManager.getInstance().indexVaultToVectorStore();
        new Notice("Vault index refreshed.");
    } catch (error) {
        console.error("Error refreshing vault index:", error);
        new Notice("Failed to refresh vault index. Check console for details.");
    }
}

export async function forceReindexVault() {
    try {
        await VectorStoreManager.getInstance().indexVaultToVectorStore(true);
        new Notice("Vault force reindexed.");
    } catch (error) {
        console.error("Error force reindexing vault:", error);
        new Notice("Failed to force reindex vault. Check console for details.");
    }
}

export async function reloadCurrentProject() {
    const currentProject = getCurrentProject();
    if (!currentProject) {
        new Notice("No project is currently selected to reload.");
        return;
    }

    // Directly execute the reload logic without a confirmation modal
    try {
        setProjectLoading(true); // Start loading indicator

        // Invalidate the markdown context first. This also cleans up file references
        // for files that no longer match project patterns. It will also clear
        // web/youtube contexts to force their reload.
        await ProjectContextCache.getInstance().invalidateMarkdownContext(currentProject, true);

        // Then, trigger the full load and processing logic via ProjectManager.
        // getProjectContext will call loadProjectContext if markdownNeedsReload is true (which it is now).
        // loadProjectContext will handle markdown, web, youtube, and other file types (including API calls for new ones).
        const plugin = (app as any).plugins.getPlugin("copilot");
        if (plugin && plugin.projectManager) {
            await plugin.projectManager.getProjectContext(currentProject.id);
            new Notice(`Project context for "${currentProject.name}" reloaded successfully.`);
        } else {
            throw new Error("Copilot plugin or ProjectManager not available.");
        }
    } catch (error) {
        logError("Error reloading project context:", error);

        // Check if this is a rate limit error and let the FileParserManager notice handle it
        if (!isRateLimitError(error)) {
            new Notice("Failed to reload project context. Check console for details.");
        }
        // If it's a rate limit error, don't show generic failure message - let the rate limit notice show
    } finally {
        setProjectLoading(false); // Stop loading indicator
    }
}

export async function forceRebuildCurrentProjectContext() {
    const currentProject = getCurrentProject();
    if (!currentProject) {
        new Notice("No project is currently selected to rebuild.");
        return;
    }

    const modal = new ConfirmModal(
        app,
        async () => {
            try {
                setProjectLoading(true); // Start loading indicator
                new Notice(
                    `Force rebuilding context for project: ${currentProject.name}... This will take some time and re-fetch all data.`,
                    10000 // Longer notice as this is a bigger operation
                );

                // Step 1: Completely clear all cached data for this project (in-memory and on-disk)
                // Reset rate limit notice timer to allow showing notices during force rebuild
                Docs4LLMParser.resetRateLimitNoticeTimer();

                await ProjectContextCache.getInstance().clearForProject(currentProject);
                new Notice(`Cache for project "${currentProject.name}" has been cleared.`);

                // Step 2: Trigger a full reload from scratch.
                // getProjectContext will call loadProjectContext as the cache is now empty.
                // loadProjectContext will handle markdown, web, youtube, and all other file types.
                const plugin = (app as any).plugins.getPlugin("copilot");
                if (plugin && plugin.projectManager) {
                    await plugin.projectManager.getProjectContext(currentProject.id);
                    new Notice(
                        `Project context for "${currentProject.name}" rebuilt successfully from scratch.`
                    );
                } else {
                    throw new Error("Copilot plugin or ProjectManager not available for rebuild.");
                }
            } catch (error) {
                logError("Error force rebuilding project context:", error);

                // Check if this is a rate limit error and let the FileParserManager notice handle it
                if (!isRateLimitError(error)) {
                    new Notice(
                        "Failed to force rebuild project context. Check console for details."
                    );
                }
                // If it's a rate limit error, don't show generic failure message - let the rate limit notice show
            } finally {
                setProjectLoading(false); // Stop loading indicator
            }
        },
        // Confirmation message with a strong warning
        `DANGER: This will permanently delete all cached data (markdown, web URLs, YouTube transcripts, and processed file content) for the project "${currentProject.name}" from both memory and disk. The context will then be rebuilt from scratch, re-fetching all remote data and re-processing all local files. This cannot be undone. Are you absolutely sure?`,
        "Force Rebuild Project Context" // Modal title
    );
    modal.open();
}

interface ChatControlsProps {
    onNewChat: () => void;
    onSaveAsNote: () => void;
    onLoadHistory: () => void;
    onModeChange: (mode: ChainType) => void;
    onCloseProject?: () => void;
}

export function ChatControls({
    onNewChat,
    onSaveAsNote,
    onLoadHistory,
    onModeChange,
    onCloseProject,
}: ChatControlsProps) {
    const settings = useSettingsValue();
    const [selectedChain, setSelectedChain] = useChainType();
    const isPlusUser = useIsPlusUser();

    const handleModeChange = (chainType: ChainType) => {
        setSelectedChain(chainType);
        onModeChange(chainType);
        if (chainType !== ChainType.PROJECT_CHAIN) {
            setCurrentProject(null);
            onCloseProject?.();
        }
    };

    return (
        <div className="tw-flex tw-w-full tw-items-center tw-justify-between tw-p-1">
            <div className="tw-flex-1">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost2"
                            size="icon"
                            title="New Chat"
                            onClick={() => {
                                console.log("New chat clicked");
                            }}
                        >
                            <MessageCircleCode className="tw-size-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Add Context</TooltipContent>
                </Tooltip>
            </div>
            <div>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost2" size="icon" title="New Chat" onClick={onNewChat}>
                            <MessageCirclePlus className="tw-size-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>New Chat</TooltipContent>
                </Tooltip>
                {!settings.autosaveChat && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost2"
                                size="icon"
                                title="Save Chat as Note"
                                onClick={onSaveAsNote}
                            >
                                <Download className="tw-size-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Save Chat as Note</TooltipContent>
                    </Tooltip>
                )}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost2"
                            size="icon"
                            title="Chat History"
                            onClick={onLoadHistory}
                        >
                            <History className="tw-size-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Chat History</TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
}
