import {BaseTool} from "./basetool"
import { postSlackSnippet } from "./postSlackSnippet";
import { SlackEvent } from "./slackevent";
import { ToolInterface } from "./toolinterface";

export class codeReplyTool extends BaseTool implements ToolInterface{
    constructor() {
        super("/code_reply", `"/code_reply FILENAME"のようなインプットがあった場合、二行目以降に書かれたコードをシンタックスハイライトしてHumanに渡す。FILENAMEには言語に応じた適切な拡張子をつけて渡す必要がある。`)
    }
    checkInput(message:string) {
        const inputs = this.extractMessage(message);
        if (inputs.args.length > 0 && inputs.lines.length > 1) {
            return true;
        }
        else {
            return false;
        }
    }
    use(message:string, slackEvent:SlackEvent) {
        const ts = slackEvent.thread_ts || slackEvent.ts;
        const inputs = this.extractMessage(message);
        const filename = inputs.args[0];
        const code = inputs.lines.slice(1).join("\n");

        // スニペットで返す
        postSlackSnippet(code, slackEvent.channel, ts, filename);
        return code;
    }
}