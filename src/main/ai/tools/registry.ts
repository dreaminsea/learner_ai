import type { ToolDefinition } from './types'
import { searchNodesTool } from './searchNodes'
import { getPlansTool } from './getPlans'
import { createPlanTool } from './createPlan'
import { getUserContextTool } from './getUserContext'

class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()

  constructor() {
    this.register(searchNodesTool)
    this.register(getPlansTool)
    this.register(createPlanTool)
    this.register(getUserContextTool)
  }

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  /** Returns tools in OpenAI function-calling format */
  getOpenAITools(): Array<{
    type: 'function'
    function: { name: string; description: string; parameters: Record<string, unknown> }
  }> {
    return this.getAll().map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }))
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`Tool not found: ${name}`)
    return tool.execute(args)
  }
}

export const toolRegistry = new ToolRegistry()
