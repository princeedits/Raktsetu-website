import { Router, type IRouter } from "express";
import healthRouter from "./health";
import raktsetuRouter from "./raktsetu";

const router: IRouter = Router();

router.use(healthRouter);
router.use(raktsetuRouter);

export default router;
