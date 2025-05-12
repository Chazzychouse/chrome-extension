import { ReferencedEntityStringIdFilter } from "../referencedEntity/ReferencedEntityFilter";

export interface AdvancedIssueFilter {
    filter: IssueFilter;
}

export interface IssueFilter {
    submittedByUser: ReferencedEntityStringIdFilter;
}
