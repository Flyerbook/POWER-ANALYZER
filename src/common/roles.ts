/* 
    A given role is mapped to a binary value.
    Instead of iterating through a collection of scopes, we only need to match bits.
    As a bonus, adding new roles is trivial and we don't need to worry about breaking code.
    However, we have to be careful with the bit mappings.
    Example
        - manager  = 0011
        - seller = 0001
        - basic   = 0000
    If we want to add the "supplier" role that doesn't have the same privileges as "seller":
        - supplier = 0010
        - supplier = 0100
    In the first case "supplier" also has the privileges of "manager".
    In the second case, "supplier" doesn't share privileges with any other role.
*/
export enum Role {
    BASIC = "basic",
    SELLER = "seller",
    MANAGER = "manager",
    ADMIN = "admin",
}

// "Admin" should always be greater than everyone else's
export const roleValue = {
    [Role.BASIC]: 0x00,
    [Role.SELLER]: 0x01,
    [Role.MANAGER]: 0x0F,
    [Role.ADMIN]: 0xFF,
};

/**
 * Check if a given role has the same or more privileges than another.
 * 
 * @param actualRole Given role.
 * @param targetRole Target role.
 * @returns True if given role has same or more privileges.
 */
 export function hasRolePrivileges(actualRole: Role, targetRole: Role): boolean {
    const target = roleValue[targetRole as keyof typeof roleValue];
    const actual = roleValue[actualRole as keyof typeof roleValue];
    return ((actual & target) === target);
}