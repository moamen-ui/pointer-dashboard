// Stub exports for AI Rules API - real implementation will come with API client update
export interface AiRuleResponse {
  id?: number;
  [key: string]: any;
}

export interface AiInsightsResponse {
  [key: string]: any;
}

export class AiRulesService {
  putApiAdminAiRulesId(id: number, data: any) {
    return { subscribe: () => {} };
  }
  deleteApiAdminAiRulesId(id: number) {
    return { subscribe: () => {} };
  }
  postApiAdminAiRules(data: any) {
    return { subscribe: () => {} };
  }
}

export interface ProjectAiRulesResponse {
  [key: string]: any;
}
