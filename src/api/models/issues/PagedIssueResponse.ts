import { IssueDTO } from './IssueDTO';

export interface PagedIssueResponse {
    values: IssueDTO[];
    pagingInformation: {
      pageNumber: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
    information?: string[];
} 