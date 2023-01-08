import { ToolInterface } from "./toolinterface";
import {BaseTool} from "./basetool"
import { postMessage } from "./postmessage";

export class calcTool extends BaseTool implements ToolInterface {
    // X*Y等の四則演算を計算して、メッセージで返すツール。
    constructor() {
        super("/calc", `"/calc X * Y"のようなインプットがあった場合、XとYを四則演算して返す。二行目以降には何も書いてはいけない。`)
    }
    checkInput(message:string) {
        const inputs = this.extractMessage(message);
        if (inputs.args.length > 2) {
            return true;
        }
        else {
            return false;
        }
    }
    use(message:string, slackEvent) {
        const ts = slackEvent.thread_ts || slackEvent.ts;
        const inputs = this.extractMessage(message);
        const x = parseFloat(inputs.args[0]);
        const operator = inputs.args[1];
        const y = parseFloat(inputs.args[2]);
        const answer = this.calcSimple(x, operator, y);
        postMessage(x + operator + y + "=" + answer, slackEvent.channel, ts);
        return x + operator + y + "=" + answer;
    }
    private calcSimple(x:number, operator:string, y:number) {
        let answer = null;
        if (operator == "+") {
            answer = x + y;
        }
        else if (operator == "-") {
            answer = x - y;
        }
        else if (operator == "*") {
            answer = x * y;
        }
        else if (operator == "/" && y != 0) {
            answer = x / y;
        }
        return answer;
    }
}
