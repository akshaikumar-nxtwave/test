const { Worker } = require("bullmq");
const { getRedis } = require("../lib/redis");
const { processRepoJob } = require("./repoWorker");

function startWorker() {
  console.log("⚙️ Starting BullMQ Worker...");

  const redis = getRedis();

  new Worker(
    "repo-processing",
    async (job) => {
      return await processRepoJob(job);
    },
    {
      connection: redis,
    }
  );
}

module.exports = { startWorker };
