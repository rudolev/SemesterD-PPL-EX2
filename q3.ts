import { 
    Exp, Program, isProgram, isBoolExp, isNumExp, isStrExp, isVarRef, 
    isPrimOp, isDefineExp, isIfExp, isAppExp, isProcExp
} from './L3/L3-ast';
import { Result, makeOk, makeFailure, bind, mapResult } from './shared/result';

/*
Purpose: Transform L2 AST to Python program string
Signature: l2ToPython(l2AST)
Type: [Exp | Program] => Result<string>
*/
export const l2ToPython = (exp: Exp | Program): Result<string> => {
    if (isProgram(exp)) {
        return bind(mapResult(l2ToPython, exp.exps), (exps: string[]) => 
            makeOk(exps.join("\n")));
    }
    if (isDefineExp(exp)) {
        return bind(l2ToPython(exp.val), (val: string) => 
            makeOk(`${exp.var.var} = ${val}`));
    }
    if (isNumExp(exp)) 
        return makeOk(exp.val.toString());
    if (isBoolExp(exp)) 
        return makeOk(exp.val ? "True" : "False");
    if (isStrExp(exp)) 
        return makeOk(`"${exp.val}"`);
    if (isVarRef(exp)) 
        return makeOk(exp.var);
    
    if (isPrimOp(exp)) {
        const opMap: Record<string, string> = { "=": "==", "and": "and", "or": "or", "not": "not" };
        return makeOk(opMap[exp.op] || exp.op);
    }

    if (isIfExp(exp)) {
        return bind(l2ToPython(exp.test), (test) =>
            bind(l2ToPython(exp.then), (then) =>
                bind(l2ToPython(exp.alt), (alt) =>
                    makeOk(`(${then} if ${test} else ${alt})`))));
    }

    if (isProcExp(exp)) {
        return bind(mapResult(l2ToPython, exp.body), (body: string[]) => {
            const vars = exp.args.map(v => v.var).join(",");
            return makeOk(`(lambda ${vars} : ${body[0]})`);
        });
    }

    if (isAppExp(exp)) {
        return bind(l2ToPython(exp.rator), (rator) =>
            bind(mapResult(l2ToPython, exp.rands), (rands: string[]) => {
                if (isPrimOp(exp.rator)) {
                    const op = exp.rator.op;
                    if (op === "not") {
                        return makeOk(`(not ${rands[0]})`);
                    }
                    if (["+", "-", "*", "/", ">", "<", "=", "and", "or"].includes(op)) {
                        const pythonOp = op === "=" ? "==" : op;
                        return makeOk(`(${rands.join(` ${pythonOp} `)})`);
                    }
                }
                return makeOk(`${rator}(${rands.join(",")})`);
            }));
    }

    return makeFailure(`Unknown L2 expression`);
};