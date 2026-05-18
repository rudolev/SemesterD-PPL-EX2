import { SExpValue, Value, valueToString } from "../L3/L3-value";
import { Result, bind, isOk, makeOk, makeFailure } from "../shared/result";
import { parseL3} from "../L3/L3-ast";
import {  evalL3program } from '../L3/L3-eval-sub';


const evalP = (x: string): Result<Value> =>
    bind(parseL3(x), evalL3program);

const evalP2String = (x: string): string => {
    const res : Result<SExpValue> = bind(parseL3(x), evalL3program);
    return isOk(res) ? valueToString(res.value) : res.message;
}

let program = `(L3 ((lambda (x y) (+ x y)) 3 4))`;

let result = evalP(program);
let a = 11;