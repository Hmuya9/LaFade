import Pusher from "pusher";
import PusherJS from "pusher-js";

const appId = process.env.PUSHER_APP_ID!;
const key = process.env.PUSHER_APP_KEY!;
const secret = process.env.PUSHER_APP_SECRET!;
const cluster = process.env.PUSHER_APP_CLUSTER!;

if (!appId || !key || !secret || !cluster) {
  // eslint-disable-next-line no-console
  console.warn("⚠️ Missing Pusher env vars, real-time features disabled.");
}

declare global {
  // eslint-disable-next-line no-var
  var _pusherServer: Pusher | undefined;
}

export const pusherServer =
  global._pusherServer ??
  new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });

if (process.env.NODE_ENV !== "production") {
  global._pusherServer = pusherServer;
}

export function createPusherClient() {
  if (
    !process.env.NEXT_PUBLIC_PUSHER_APP_KEY ||
    !process.env.NEXT_PUBLIC_PUSHER_APP_CLUSTER
  ) {
    // eslint-disable-next-line no-console
    console.warn(
      "⚠️ Missing NEXT_PUBLIC_PUSHER_APP_KEY/CLUSTER, Pusher client disabled."
    );
  }

  return new PusherJS(process.env.NEXT_PUBLIC_PUSHER_APP_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_APP_CLUSTER!,
  });
}


