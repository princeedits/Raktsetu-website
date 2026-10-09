import { Router, type IRouter } from "express";
import adminRouter from "./admin";
import donorsRouter from "./donors";
import requestsRouter from "./requests";
import safetyRouter from "./safety";

const router: IRouter = Router();

router.use(donorsRouter);
router.use(requestsRouter);
router.use(safetyRouter);
router.use(adminRouter);

export default router;
