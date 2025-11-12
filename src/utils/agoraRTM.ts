// 🧹 TODO AGORA REFACTOR
// import AgoraRTM from "agora-rtm-sdk";

export const createRTMClient = (appId: string) => {
  // return AgoraRTM.createInstance(appId);
  throw new Error("Agora RTM client creation is disabled - TODO: refactor");
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
