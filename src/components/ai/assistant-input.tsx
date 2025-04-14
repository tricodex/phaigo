/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { LucideIcon } from "lucide-react";
import {
    Text,
    SendIcon,
    CheckCheck,
    ArrowDownWideNarrow,
    CornerRightDown,
    CreditCard,
    FileText,
    BarChart,
    Loader2,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";

interface ActionItem {
    text: string;
    icon: LucideIcon;
    colors: {
        icon: string;
        border: string;
        bg: string;
    };
    description?: string;
}

interface AssistantInputProps {
    id?: string;
    placeholder?: string;
    minHeight?: number;
    maxHeight?: number;
    actions?: ActionItem[];
    loading?: boolean;
    onSubmit?: (text: string, action?: string) => void;
    className?: string;
}

const DEFAULT_ACTIONS: ActionItem[] = [
    {
        text: "Send Payment",
        icon: CreditCard,
        colors: {
            icon: "text-blue-600",
            border: "border-blue-500",
            bg: "bg-blue-100",
        },
        description: "Send PYUSD to someone",
    },
    {
        text: "Request Payment",
        icon: FileText,
        colors: {
            icon: "text-emerald-600",
            border: "border-emerald-500",
            bg: "bg-emerald-100",
        },
        description: "Create a payment request",
    },
    {
        text: "Check Balance",
        icon: BarChart,
        colors: {
            icon: "text-purple-600",
            border: "border-purple-500",
            bg: "bg-purple-100",
        },
        description: "View your PYUSD balance",
    },
];

export function AssistantInput({
    id = "assistant-input",
    placeholder = "How can I help you?",
    minHeight = 64,
    maxHeight = 200,
    actions = DEFAULT_ACTIONS,
    loading = false,
    onSubmit,
    className
}: AssistantInputProps) {
    const [inputValue, setInputValue] = useState("");
    const [selectedItem, setSelectedItem] = useState<string | null>(null);
    const lastLoadingState = useRef(loading);

    // Log loading state changes for debugging
    useEffect(() => {
        console.log(`📝 AssistantInput - Loading state changed: ${loading}`);
        lastLoadingState.current = loading;
    }, [loading]);

    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight,
        maxHeight,
    });

    const toggleItem = (itemText: string) => {
        setSelectedItem((prev) => (prev === itemText ? null : itemText));
    };

    const currentItem = selectedItem
        ? actions.find((item) => item.text === selectedItem)
        : null;

    const handleSubmit = () => {
        // Immediately check loading state to avoid any race conditions
        const isCurrentlyLoading = lastLoadingState.current;
        
        console.log("📤 AssistantInput - handleSubmit called. Input value:", inputValue);
        console.log("🔄 AssistantInput - Current loading state:", isCurrentlyLoading);
        
        if (inputValue.trim() && !isCurrentlyLoading) {
            console.log(`📨 AssistantInput - Submitting message with action: ${selectedItem ?? "none"}`);
            onSubmit?.(inputValue, selectedItem ?? undefined);
            setInputValue("");
            setSelectedItem(null);
            adjustHeight(true);
        } else {
            console.log("❌ AssistantInput - Not submitting. Empty input or loading:", 
                      !inputValue.trim() ? "empty input" : "loading");
        }
    };

    // Reset textarea height on window resize
    useEffect(() => {
        const handleResize = () => adjustHeight(true);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [adjustHeight]);

    return (
        <div className={cn("w-full py-4", className)}>
            <div className="relative max-w-xl w-full mx-auto">
                <div className="relative border border-black/10 dark:border-white/10 focus-within:border-black/20 dark:focus-within:border-white/20 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03]">
                    <div className="flex flex-col">
                        <div
                            className="overflow-y-auto"
                            style={{ maxHeight: `${maxHeight - 48}px` }}
                        >
                            <Textarea
                                ref={textareaRef}
                                id={id}
                                placeholder={placeholder}
                                className={cn(
                                    "max-w-xl w-full rounded-2xl pr-10 pt-3 pb-3 placeholder:text-black/70 dark:placeholder:text-white/70 border-none focus:ring text-black dark:text-white resize-none text-wrap bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 leading-[1.2]",
                                    `min-h-[${minHeight}px]`
                                )}
                                value={inputValue}
                                disabled={loading}
                                onChange={(e) => {
                                    setInputValue(e.target.value);
                                    adjustHeight();
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        console.log("⌨️ AssistantInput - Enter key pressed for submission");
                                        e.preventDefault();
                                        handleSubmit();
                                    }
                                }}
                                data-loading={loading ? "true" : "false"}
                            />
                        </div>

                        <div className="h-12 bg-transparent flex items-center">
                            {currentItem && (
                                <div className="absolute left-3 bottom-3 z-10">
                                    <div
                                        className={cn(
                                            "inline-flex items-center gap-1.5",
                                            "border shadow-sm rounded-md px-2 py-0.5 text-xs font-medium",
                                            "animate-fadeIn",
                                            currentItem.colors.bg,
                                            currentItem.colors.border
                                        )}
                                    >
                                        <currentItem.icon
                                            className={`w-3.5 h-3.5 ${currentItem.colors.icon}`}
                                        />
                                        <span
                                            className={currentItem.colors.icon}
                                        >
                                            {selectedItem}
                                        </span>
                                    </div>
                                </div>
                            )}
                            
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!inputValue.trim() || loading}
                                className={cn(
                                    "absolute right-3 bottom-3 p-1 rounded-full",
                                    "transition-all duration-200",
                                    inputValue.trim() && !loading
                                        ? "bg-blue-500 text-white hover:bg-blue-600"
                                        : "bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed"
                                )}
                                aria-label={loading ? "Loading" : "Send message"}
                                data-loading={loading ? "true" : "false"}
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-300" />
                                ) : (
                                    <SendIcon className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2 max-w-xl mx-auto justify-start px-4">
                {actions.filter((item) => item.text !== selectedItem).map(
                    ({ text, icon: Icon, colors, description }) => (
                        <button
                            type="button"
                            key={text}
                            className={cn(
                                "px-3 py-1.5 text-xs font-medium rounded-full",
                                "border transition-all duration-200",
                                "border-black/10 dark:border-white/10 bg-white dark:bg-gray-900 hover:bg-black/5 dark:hover:bg-white/5",
                                "flex-shrink-0"
                            )}
                            onClick={() => toggleItem(text)}
                            title={description}
                            disabled={loading}
                        >
                            <div className="flex items-center gap-1.5">
                                <Icon className={cn("h-4 w-4", colors.icon)} />
                                <span className="text-black/70 dark:text-white/70 whitespace-nowrap">
                                    {text}
                                </span>
                            </div>
                        </button>
                    )
                )}
            </div>
        </div>
    );
}
