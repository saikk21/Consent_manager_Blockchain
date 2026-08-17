import type { DbPool } from "../../persistence/db/pool.js";
import type { ConsentLifecycleService } from "../../services/consentLifecycle/consentLifecycleService.js";
import type { ConsentQueryService } from "../../services/consentQuery/consentQueryService.js";
import type { ProofQueryService } from "../../services/proof/proofQueryService.js";
import type { PolicyService } from "../../services/policy/policyService.js";
import type { WidgetSessionService } from "../../services/widget/widgetSessionService.js";
import type { WidgetRuntimeService } from "../../services/widget/widgetRuntimeService.js";
import type { WebhookManagementService } from "../../services/webhooks/webhookManagementService.js";
import type { WebhookEventService } from "../../services/webhooks/webhookEventService.js";

export type Services = Readonly<{
  consentLifecycle: ConsentLifecycleService;
  consentQuery: ConsentQueryService;
  proofQuery: ProofQueryService;
  policy: PolicyService;
  widgetSession: WidgetSessionService;
  widgetRuntime: WidgetRuntimeService;
  webhookManagement: WebhookManagementService;
  webhookEvent: WebhookEventService;
}>;

declare module "fastify" {
  interface FastifyInstance {
    pool: DbPool;
    services: Services;
  }

  interface FastifyRequest {
    companyId?: string;
  }
}

