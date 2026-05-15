// L3-eval.ts
// Evaluator with Environments model

import { map, none } from "ramda";
import { isBoolExp, isCExp, isLitExp, isNumExp, isPrimOp, isStrExp, isVarRef,
         isAppExp, isDefineExp, isIfExp, isLetExp, isProcExp,
         Binding, VarDecl, CExp, Exp, IfExp, LetExp, ProcExp, Program,
         parseL3Exp,  DefineExp, isClassExp, ClassExp} from "./L3-ast";
import { applyEnv, makeEmptyEnvEnv, makeExtEnvEnv, EnvEnv } from "./L3-env-env";
import { isClosure, makeClosureEnv, Closure, Value, makeClass, Class, isClass, 
         Object, isObject, isSymbolSExp, makeObject } from "./L3-value";
import { applyPrimitive } from "./evalPrimitive";
import { first, rest, isEmpty, isNonEmptyList } from "../shared/list";
import { Result, makeOk, makeFailure, bind, mapResult } from "../shared/result";
import { parse as p } from "../shared/parser";
import { format } from "../shared/format";
import { substitute } from "./substitute";

// ========================================================
// Eval functions

const applicativeEval = (exp: CExp, env: EnvEnv): Result<Value> =>
    isNumExp(exp) ? makeOk(exp.val) :
    isBoolExp(exp) ? makeOk(exp.val) :
    isStrExp(exp) ? makeOk(exp.val) :
    isPrimOp(exp) ? makeOk(exp) :
    isVarRef(exp) ? applyEnv(env, exp.var) :
    isLitExp(exp) ? makeOk(exp.val) :
    isIfExp(exp) ? evalIf(exp, env) :
    isProcExp(exp) ? evalProc(exp, env) :
    isLetExp(exp) ? evalLet(exp, env) :
    // L31
    isClassExp(exp) ? evalClass(exp, env):
    isAppExp(exp) ? bind(applicativeEval(exp.rator, env),
                      (proc: Value) =>
                        bind(mapResult((rand: CExp) => 
                           applicativeEval(rand, env), exp.rands),
                              (args: Value[]) =>
                                 applyProcedure(proc, args))) :
    makeFailure('"let" not supported (yet)');

export const isTrueValue = (x: Value): boolean =>
    ! (x === false);

const evalIf = (exp: IfExp, env: EnvEnv): Result<Value> =>
    bind(applicativeEval(exp.test, env), (test: Value) => 
            isTrueValue(test) ? applicativeEval(exp.then, env) : 
            applicativeEval(exp.alt, env));

const evalProc = (exp: ProcExp, env: EnvEnv): Result<Closure> =>
    makeOk(makeClosureEnv(exp.args, exp.body, env));

// KEY: This procedure does NOT have an env parameter.
//      Instead we use the env of the closure.
const applyProcedure = (proc: Value, args: Value[]): Result<Value> =>
    isPrimOp(proc) ? applyPrimitive(proc, args) :
    isClosure(proc) ? applyClosure(proc, args) :
    // L31: 
    isClass(proc) ? applyClass(proc, args) :
    isObject(proc) ? applyObject(proc, args) : 

    makeFailure(`Bad procedure ${format(proc)}`);

const applyClosure = (proc: Closure, args: Value[]): Result<Value> => {
    const vars = map((v: VarDecl) => v.var, proc.params);
    const procEnv: EnvEnv = proc.env as EnvEnv;
    return evalSequence(proc.body, makeExtEnvEnv(vars, args, procEnv));
}

// Evaluate a sequence of expressions (in a program)
export const evalSequence = (seq: Exp[], env: EnvEnv): Result<Value> =>
    isNonEmptyList<Exp>(seq) ? evalCExps(first(seq), rest(seq), env) : 
    makeFailure("Empty sequence");
    
const evalCExps = (first: Exp, rest: Exp[], env: EnvEnv): Result<Value> =>
    isDefineExp(first) ? evalDefineExps(first, rest, env) :
    isCExp(first) && isEmpty(rest) ? applicativeEval(first, env) :
    isCExp(first) ? bind(applicativeEval(first, env), _ => evalSequence(rest, env)) :
    first;
    
// Eval a sequence of expressions when the first exp is a Define.
// Compute the rhs of the define, extend the env with the new binding
// then compute the rest of the exps in the new env.
const evalDefineExps = (def: DefineExp, exps: Exp[], env: EnvEnv): Result<Value> =>
    bind(applicativeEval(def.val, env), (rhs: Value) => 
            evalSequence(exps, makeExtEnvEnv([def.var.var], [rhs], env)));


// Main program
export const evalL3program = (program: Program): Result<Value> =>
    evalSequence(program.exps, makeEmptyEnvEnv());

export const evalParse = (s: string): Result<Value> =>
    bind(p(s), (x) => 
        bind(parseL3Exp(x), (exp: Exp) =>
            evalSequence([exp], makeEmptyEnvEnv())));

// LET: Direct evaluation rule without syntax expansion
// compute the values, extend the env, eval the body.
const evalLet = (exp: LetExp, env: EnvEnv): Result<Value> => {
    const vals  = mapResult((v: CExp) => 
        applicativeEval(v, env), map((b: Binding) => b.val, exp.bindings));
    const vars = map((b: Binding) => b.var.var, exp.bindings);
    return bind(vals, (vals: Value[]) => 
        evalSequence(exp.body, makeExtEnvEnv(vars, vals, env)));
}

// L31
const evalClass = (exp: ClassExp, env: EnvEnv): Result<Value> => {
    // Simply wrap the AST components into a Value type with the current env
    return makeOk(makeClass(exp.fields, exp.methods, env));
}

// L31: 
const applyClass = (cls: Class, args: Value[]): Result<Value> => {
    if (cls.fields.length !== args.length) {
        return makeFailure(`Class expected ${cls.fields.length} arguments, but got ${args.length}`);
    }

    const fieldNames = map((f: VarDecl) => f.var, cls.fields);

    // Return an ObjectValue instead of a Closure
    return makeOk(makeObject(cls.methods, cls.env));
};

// L31:
const applyObject = (obj: Object, args: Value[]): Result<Value> => {
    if (args.length === 0) return makeFailure("No method name provided");
    const methodName = args[0];
    if (!isSymbolSExp(methodName)) 
        return makeFailure("Method name must be a symbol");

    // Find the method in the object's baked-in methods
    const method = obj.methods.find(m => m.var.var === methodName.val);
    if (!method) 
        return makeFailure(`Unrecognized method: ${methodName.val}`);

    return makeOk(5);
};
