import AgoraRTM from "agora-rtm-sdk";

export const createRTMClient = (appId: string) => {
  return AgoraRTM.createInstance(appId);
};

export const encodeMessage = (text: string) => {
  return { text };
};

export const decodeMessage = (rawMessage: any): string => {
  if (typeof rawMessage === "string") {
    return rawMessage;
  }
  if (rawMessage.text) {
    return rawMessage.text;
  }
  return JSON.stringify(rawMessage);
};
