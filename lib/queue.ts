import { Queue } from "bullmq";
const { getRedis } = require("./redis");

// 👇 give queue a proper type instead of `any`
let queue: Queue | null = null;

export function getQueue(): Queue {
  if (!queue) {
    queue = new Queue("repo-processing", {
      connection: getRedis(),
    });
  }
  return queue;
}
