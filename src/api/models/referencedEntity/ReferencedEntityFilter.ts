import { StringFilter, IntFilter } from "../baseFilter";

export interface ReferencedEntityStringIdFilter {
    id?: StringFilter;
    iid?: IntFilter;
    name?: StringFilter;
}

export interface ReferencedEntityIntIdFilter {
    id?: IntFilter;
    iid?: IntFilter;
    name?: StringFilter;
}
