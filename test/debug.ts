import { expect } from 'chai';
import { parseL3 } from '../L3/L3-ast';
import { evalL3program } from '../L3/L3-eval-sub';
import { parseL3 } from "../L3/L3-ast";


let program = `
        (L3
         (define pair 
            (class (a b) 
               ((first (lambda () a)) 
                (second (lambda () b))
                (sum (lambda () (+ a b)))
                (f (lambda (k) (/ (* k a) (* k b))))
               )
             )
         )
         pair
        )`;

let res1 = parseL3(program).value;
let res2 = evalL3program(res1);
let a = 3;