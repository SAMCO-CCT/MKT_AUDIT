type LineTextMessage = {
  type: "text";
  text: string;
};

export async function sendLineMessage(message: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const targetId = process.env.LINE_TARGET_ID;

  if (!token) {
    throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN");
  }

  if (!targetId) {
    throw new Error("Missing LINE_TARGET_ID");
  }

  const body = {
    to: targetId,
    messages: [
      {
        type: "text",
        text: message,
      } satisfies LineTextMessage,
    ],
  };

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`LINE push message failed: ${res.status} ${errorText}`);
  }

  return true;
}