import { expect } from 'chai';
import { unparseL3, parseL3, parseL3Exp } from '../L3/L3-ast';
import { makeOk, bind, isFailure } from '../shared/result';
import { parse } from "../shared/parser";

let program = `
    (class (a b) 
    ((first (lambda () a)) 
        (second (lambda () b)) 
        (sum (lambda () (+ a b)))))`;

let res = parse(program).value;

let l3res = parseL3Exp(res);
let unparsec = unparseL3(l3res.value);

let a = 3;