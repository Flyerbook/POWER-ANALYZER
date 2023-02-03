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

// "Admin" should always b