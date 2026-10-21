// backend/src/modules/staff/staff.service.ts

import { getAllDepartments } from '../../shared/services/department.service';
import { CATEGORY_TAXONOMY, OTHER_OPTION_LABEL } from '../../shared/constants/taxonomy.constants';
import { SEVERITY_LEVELS, SEVERITY_METADATA } from '../../shared/constants/severity.constants';

/**
 * Service handling business logic for Hospital Staff workflows.
 * Orchestrates shared master data (departments, taxonomy, severities)
 * into a single unified configuration bundle for incident reporting.
 */
export class StaffService {
  /**
   * Constructs the complete incident reporting setup bundle for the Staff Portal.
   * Dynamically loads:
   * 1. Active hospital departments from the database (via shared department service)
   * 2. Standardized clinical incident categories and subcategories
   * 3. Severity risk levels and clinical SLA response definitions
   * 
   * @returns Unified configuration object for frontend dropdowns and validators
   */
  async getConfig() {
    // 1. Fetch active departments from shared database service
    const departments = await getAllDepartments();

    // 2. Return assembled configuration bundle
    return {
      departments,
      categories: CATEGORY_TAXONOMY,
      severities: [...SEVERITY_LEVELS],
      severityMetadata: SEVERITY_METADATA,
      otherOptionLabel: OTHER_OPTION_LABEL,
    };
  }
}

// Export singleton instance of the service
export const staffService = new StaffService();