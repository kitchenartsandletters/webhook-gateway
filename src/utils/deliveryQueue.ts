type DeliveryItem = {
  topic: string;
  payload: any;
  targetUrl: string;
  attemptCount: number;
  delayMs: number;
  retry: () => void;
};

const queue: DeliveryItem[] = [];

export const addToQueue = (item: DeliveryItem) => {
  console.log(`[Queue] Scheduling retry in ${item.delayMs}ms for ${item.topic}`);

  setTimeout(() => {
    console.log(`[Queue] Retrying ${item.topic}, attempt ${item.attemptCount}`);
    item.retry();
  }, item.delayMs);

  queue.push(item);
};

export const getQueueLength = () => queue.length;
