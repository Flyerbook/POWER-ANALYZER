
/**
 * Product price in Euro cents.
 * 
 * @minimum 0 minimum 0.
 * @maximum 200000 maximum 200000.
 * @isInt
 */
 export type Price = number;

/** The available Product categories */
export enum ProductCategory {
    TSHIRT = "tshirt",
    BAG = "bag",
    BOOK = "book",
}

/** The available Tshirt sizes */
export enum TshirtSize {
    KID = "kid",
    XS = "xs",
    S = "s",
    M = "m",
    L = "l",
    XL = "xl"
}

/** The available Tshirt colours */
export enum TshirtColour {
    RED = "red",
    GREEN = "green",
    BLUE = "blue",
    YELLOW = "yellow",
    ORANGE = "orange",
    PURPLE = "purple",
    BLACK = "black",
    WHITE = "white",
}

/** The available Bag categories */
export enum BagColour {
    RED = "red",
    GREEN = "green",
    BLUE = "blue",
    YELLOW = "yellow",
    ORANGE = "orange",
    PURPLE = "purple",
    BLACK = "black",
    WHITE = "white",
}