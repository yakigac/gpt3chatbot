export class BaseTool {
    name: string;
    description: string;

    constructor(name:string, description:string) {
        this.name = name;
        this.description = description;
    }
    extractMessage(message: string) {
        const lines = message.trim().split("\n");
        const tool_and_arguments = (lines.length > 0 ? lines[0].trim().split(" ") : null);
        const tool = (tool_and_arguments.length > 0 ? tool_and_arguments[0] : null);
        const args = (tool_and_arguments.length > 1 ? tool_and_arguments.slice(1) : []);
        return { lines: lines, tool: tool, args: args }
    }
}