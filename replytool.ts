import {BaseTool} from "./basetool"
import { ToolInterface } from "./toolinterface";
import { SlackEvent } from "./slackevent";
import { postSlackMessage } from "./postslackmessage";
export class replyTool extends BaseTool implements ToolInterface {
    constructor() {
        super("/reply", '"/reply"のようなインプットがあった場合、二行目以降のメッセージを人間に送る。');
    }
    checkInput(message:string) {
        return true;
    }
    use(message:string, slackEvent:SlackEvent) {
        const ts = slackEvent.thread_ts || slackEvent.ts;
        const inputs = this.extractMessage(message);
        const message_to_human = inputs.args.join(" ") + "\n" + inputs.lines.slice(1).join("\n");
        postSlackMessage(message_to_human, slackEvent.channel, ts);
        return message_to_human;
    }
}