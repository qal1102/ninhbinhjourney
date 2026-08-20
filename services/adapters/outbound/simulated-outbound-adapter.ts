export type OutboundDeliveryRequest = {
  actionId: string;
  channel: "email" | "sms" | "zalo";
  idempotencyKey: string;
  templateCode: string;
};

export type OutboundDeliveryResult = {
  outcome: "simulated-delivered";
  providerEventId: string;
};

/**
 * Contract only: it never reads contact ciphertext and never calls a provider.
 * A real adapter needs separate Xuân Trường policy, sender identity and secrets.
 */
export interface OutboundAdapter {
  readonly name: string;
  readonly version: string;
  deliver(request: OutboundDeliveryRequest): Promise<OutboundDeliveryResult>;
}

export const simulatedOutboundAdapter: OutboundAdapter = {
  name: "outbound-simulation",
  version: "1.0",
  async deliver(request) {
    return { outcome: "simulated-delivered", providerEventId: `sim-${request.actionId}` };
  },
};
