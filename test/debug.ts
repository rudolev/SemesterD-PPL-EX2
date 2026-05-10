import { parseL3 } from '../L3/L3-ast';
import { evalL3program } from '../L3/L3-eval-sub';
import { SExpValue, Value, valueToString } from "../L3/L3-value";


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
            (define p34 (pair 3 4))
            p34
        )
        `;

let res1 = parseL3(program).value;
let res2 = evalL3program(res1);
let res3 = valueToString(res2.value)
let a = 3;