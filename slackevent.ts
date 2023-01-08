export type SlackEvent = {
    type: string;
    text: string;
    channel: string;
    ts:string;
    thread_ts?:string;
}
