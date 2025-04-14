/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  ChevronsDown,
  ChevronsUp,
  User,
  Bot,
  CreditCard,
  FileText,
  CheckCircle,
  XCircle,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";

interface MessageAction {
  label: string;
  href?: string;
  onClick?: () => void;
  isPrimary?: boolean;
  icon?: React.ReactNode;
}

interface AssistantMessageProps {
  role: "user" | "assistant";
  content: string;
  actions?: MessageAction[];
  timestamp?: Date;
  className?: string;
}

export function AssistantMessage({
  role,
  content,
  actions = [],
  timestamp = new Date(),
  className,
}: AssistantMessageProps) {
  const [expanded, setExpanded] = useState(true);
  
  // Debug logging for actions - IMPROVED
  useEffect(() => {
    if (role === "assistant") {
      console.log(`🔍 AssistantMessage: ${content.substring(0, 20)}... has ${actions?.length || 0} actions`);
      console.log(`Actions array is:`, actions);
      console.log(`Actions is array: ${Array.isArray(actions)}`);
      console.log(`Actions is defined: ${actions !== undefined}`);
      console.log(`Actions is truthy: ${Boolean(actions)}`);
      
      if (actions && actions.length > 0) {
        console.log('🔘 All Actions:', JSON.stringify(actions, null, 2));
        actions.forEach((action, index) => {
          console.log(`Action ${index}: Label=${action.label}, Link=${action.href || 'none (button)'}, HasOnClick=${!!action.onClick}`);
        });
      }
    }
  }, [role, content, actions]);
  
  // Format the timestamp
  const formattedTime = new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "numeric",
  }).format(timestamp);
  
  // Check if the message has actions - IMPROVED with debugging
  let hasActions = false;
  if (actions) {
    if (Array.isArray(actions)) {
      hasActions = actions.length > 0;
      console.log(`Message has ${actions.length} actions`);
      
      if (actions.length > 0) {
        actions.forEach((action, i) => {
          console.log(`Action ${i} valid:`, {
            hasLabel: !!action.label,
            hasHrefOrOnClick: !!(action.href || action.onClick),
            isPrimary: !!action.isPrimary
          });
        });
      }
    } else {
      console.log(`❌ Actions is not an array:`, actions);
    }
  } else {
    console.log(`❌ Actions is undefined for message: ${content.substring(0, 20)}...`);
  }
  
  console.log(`Final hasActions value: ${hasActions}`);
  
  return (
    <div
      className={cn(
        "flex gap-2 py-2 px-4 rounded-lg transition-colors",
        "items-center",
        role === "assistant" ? "bg-gray-50 dark:bg-gray-900" : "bg-transparent",
        className
      )}
      data-testid={`message-${role}`}
      data-has-actions={hasActions ? "true" : "false"}
    >
      <div className="flex-shrink-0">
        <Avatar className="size-6 rounded-full border bg-background">
          {role === "user" ? (
            <User className="size-6" />
          ) : (
            <Image src="/logo.png" alt="Phaigo Logo" width={24} height={24} className="size-6" />
          )}
        </Avatar>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold">
            {role === "user" ? "You" : "phaigo Assistant"}
          </p>
          <span className="text-xs text-muted-foreground">
            {formattedTime}
          </span>
        </div>
        
        <div className="relative">
          {expanded ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {content}
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none line-clamp-2">
              {content}
            </div>
          )}
          
          {content.length > 180 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-blue-500 hover:underline mt-1 flex items-center gap-1"
            >
              {expanded ? (
                <>
                  <ChevronsUp className="size-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronsDown className="size-3" />
                  Show more
                </>
              )}
            </button>
          )}
        </div>
        
        {/* Display action buttons if they exist */}
        {hasActions ? (
          <div className="flex flex-wrap gap-2 mt-3" data-testid="action-buttons">
            {actions.map((action, index) => {
              // Check if it's an external link
              const isExternalLink = action.href?.startsWith('http');
              console.log(`🔘 Rendering action ${index}:`, action.label, action.href || 'no href');
              
              return action.href ? (
                isExternalLink ? (
                  // External link (opens in new tab)
                  <a 
                    key={index} 
                    href={action.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md transition-colors",
                      action.isPrimary
                        ? "bg-blue-100 text-white hover:bg-blue-600"
                        : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700"
                    )}
                    data-testid={`action-external-${index}`}
                  >
                    {action.icon || <ExternalLink className="size-3.5" />}
                    {action.label}
                  </a>
                ) : (
                  // Internal link (uses Next.js Link)
                  <Link 
                    key={index} 
                    href={action.href}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md transition-colors",
                      action.isPrimary
                        ? "bg-blue-100 text-white hover:bg-blue-600"
                        : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700"
                    )}
                    data-testid={`action-link-${index}`}
                  >
                    {action.icon || <FileText className="size-3.5" />}
                    {action.label}
                  </Link>
                )
              ) : (
                // Button with click handler
                <Button
                  key={index}
                  variant={action.isPrimary ? "default" : "outline"}
                  size="sm"
                  onClick={action.onClick}
                  className="flex items-center gap-1.5"
                  data-testid={`action-button-${index}`}
                >
                  {action.icon || <CreditCard className="size-3.5" />}
                  {action.label}
                </Button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
