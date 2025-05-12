import { postData } from './api';
import { IssueFilter } from './models/issues/IssueFilter';
import { PagedIssueResponse } from './models/issues/PagedIssueResponse';

export async function searchIssues(issueFilter: IssueFilter): Promise<PagedIssueResponse> {
    return await postData(`${process.env.API_BASE_URL}/Issues/Search`, issueFilter);
}


