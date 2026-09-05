-- Discount policy is one number per (tier x category): the maximum discount
-- allowed without approval. Whether Finance is needed on top of a Sales
-- Manager is decided by the order-wide blended risk score, not by a per-rule
-- threshold, so those two columns are dropped.
ALTER TABLE "discount_rules" DROP COLUMN "managerApprovalThreshold";
ALTER TABLE "discount_rules" DROP COLUMN "financeApprovalThreshold";

-- The blended risk score above which Finance must approve as well. Lives on
-- the tier because the score is an order-wide figure.
ALTER TABLE "customer_tiers" ADD COLUMN "financeEscalationSeverity" DECIMAL(5,2) NOT NULL DEFAULT 5;
