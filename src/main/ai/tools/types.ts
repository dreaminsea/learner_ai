export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute(args: Record<string, unknown>): Promise<string>
}

export interface ToolCallRequest {
  id: string
  name: string
  arguments: string // JSON string
}

export interface ToolCallResult {
  toolCallId: string
  name: string
  result: string // JSON string
}
