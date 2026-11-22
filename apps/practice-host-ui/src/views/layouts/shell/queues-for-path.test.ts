import { describe, expect, it } from "vitest";
import { queuesForPath } from "./queues-for-path";

describe("queuesForPath", () => {
    it.each([
        ["/", ["patients", "appointments", "charts", "orders"]],
        ["/appointments/new", ["appointments"]],
        ["/statistics", ["finance"]],
        ["/products", ["orders"]],
        ["/administration/tasks", ["tasks"]],
        ["/administration/work-hours", ["work_time"]],
        ["/settings", ["practice", "parameters"]],
    ])("%s", (path, queues) => expect(queuesForPath(path)).toEqual(queues));
});
