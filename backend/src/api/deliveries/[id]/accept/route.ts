import { MedusaRequest, MedusaResponse } from "@medusajs/medusa";
import { ModuleRegistrationName } from "@medusajs/modules-sdk";
import { IWorkflowEngineService } from "@medusajs/types";
import { TransactionHandlerType } from "@medusajs/utils";
import { StepResponse } from "@medusajs/workflows-sdk";
import zod from "zod";
import {
  DeliveryStatus,
  IDeliveryModuleService,
} from "../../../../types/delivery/common";
import {
  handleDeliveryWorkflowId,
  notifyRestaurantStepId,
} from "../../../../workflows/delivery/handle-delivery";

const schema = zod.object({
  eta: zod.date().optional(),
});

const DEFAULT_PROCESSING_TIME = 30 * 60 * 1000; // 30 minutes

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const validatedBody = schema.parse(req.body);

  const eta =
    validatedBody.eta ||
    new Date(new Date().getTime() + DEFAULT_PROCESSING_TIME);

  const deliveryId = req.params.id;

  if (!deliveryId) {
    return res.status(400).json({ message: "Missing delivery id" });
  }

  const deliveryModuleService = req.scope.resolve<IDeliveryModuleService>(
    "deliveryModuleService"
  );

  const engineService = req.scope.resolve<IWorkflowEngineService>(
    ModuleRegistrationName.WORKFLOW_ENGINE
  );

  const delivery = await deliveryModuleService.updateDelivery(deliveryId, {
    delivery_status: DeliveryStatus.RESTAURANT_ACCEPTED,
    eta,
  });

  await engineService.setStepSuccess({
    idempotencyKey: {
      action: TransactionHandlerType.INVOKE,
      transactionId: delivery.transaction_id,
      stepId: notifyRestaurantStepId,
      workflowId: handleDeliveryWorkflowId,
    },
    stepResponse: new StepResponse(delivery, deliveryId),
    options: {
      container: req.scope,
    },
  });

  return res.status(200).json({ delivery });
}
