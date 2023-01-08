export interface ToolInterface {
    name: string;
    description: string;
    checkInput(message: string) :boolean;
    use(message: string, slackEvent:any) :string;
}