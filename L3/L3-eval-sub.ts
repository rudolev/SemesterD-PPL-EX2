// L3-eval.ts
import { map } from "ramda";
import { isCExp, isClassExp, isLetExp, Binding, 
         BoolExp, CExp, Exp, IfExp, LitExp, NumExp,
         PrimOp, ProcExp, Program, StrExp, VarDecl, ClassExp, 
         isAppExp, isBoolExp, isDefineExp, isIfExp, isLitExp, isNumExp,
         isPrimOp, isProcExp, isStrExp, isVarRef, makeBoolExp, makeLitExp, 
         makeNumExp, makeProcExp, makeStrExp, parseL3Exp } from "./L3-ast";

import { applyEnv, makeEmptyEnvSub, makeEnv, EnvSub } from "./L3-env-sub";
import { isClosure, makeClosure, Closure, Value, makeClass, Class, Object, isClass,
     makeObject, isSymbolSExp, isObject } from "./L3-value";
import { first, rest, isEmpty, List, isNonEmptyList } from '../shared/list';
import { isBoolean, isNumber, isString } from "../shared/type-predicates";
import { Result, makeOk, makeFailure, bind, mapResult, mapv } from "../shared/result";
import { renameExps, substitute } from "./substitute";
import { applyPrimitive } from "./evalPrimitive";
import { parse as p } from "../shared/parser";
import { Sexp } from "s-expression";
import { format } from "../shared/format";

// ========================================================
// Eval functions

const L3applicativeEval = (exp: CExp, env: EnvSub): Result<Value> =>
    isNumExp(exp) ? makeOk(exp.val) : 
    isBoolExp(exp) ? makeOk(exp.val) :
    isStrExp(exp) ? makeOk(exp.val) :
    isPrimOp(exp) ? makeOk(exp) :
    isVarRef(exp) ? applyEnv(env, exp.var) :
    isLitExp(exp) ? makeOk(exp.val) :
    isIfExp(exp) ? evalIf(exp, env) :
    isProcExp(exp) ? evalProc(exp, env) :
    isAppExp(exp) ? bind(L3applicativeEval(exp.rator, env), (rator: Value) =>
                        bind(mapResult(param => 
                            L3applicativeEval(param, env), 
                              exp.rands), 
                            (rands: Value[]) =>
                                L3applyProcedure(rator, rands, env))) :
    isLetExp(exp) ? makeFailure('"let" not supported (yet)') :
    // L31:
    isClassExp(exp) ? evalClass(exp, env):
    makeFailure('Never');

export const isTrueValue = (x: Value): boolean =>
    ! (x === false);

const evalIf = (exp: IfExp, env: EnvSub): Result<Value> =>
    bind(L3applicativeEval(exp.test, env), (test: Value) => 
        isTrueValue(test) ? L3applicativeEval(exp.then, env) : 
        L3applicativeEval(exp.alt, env));

const evalProc = (exp: ProcExp, env: EnvSub): Result<Closure> =>
    makeOk(makeClosure(exp.args, exp.body));

// L31:
const evalClass = (exp: ClassExp, env: EnvSub): Result<Class> =>
    makeOk(makeClass(exp.fields, exp.methods, env));

const L3applyProcedure = (proc: Value, args: Value[], env: EnvSub): Result<Value> =>
    isPrimOp(proc) ? applyPrimitive(proc, args) :
    isClosure(proc) ? applyClosure(proc, args, env) :
    // L31: 
    isClass(proc) ? applyClass(proc, args, env) :
    isObject(proc) ? applyObject(proc, args, env) : 

    makeFailure(`Bad procedure ${format(proc)}`);

// Applications are computed by substituting computed
// values into the body of the closure.
// To make the types fit - computed values of params must be
// turned back in Literal Expressions that eval to the computed value.
const valueToLitExp = (v: Value): NumExp | BoolExp | StrExp | LitExp | PrimOp | ProcExp =>
    isNumber(v) ? makeNumExp(v) :
    isBoolean(v) ? makeBoolExp(v) :
    isString(v) ? makeStrExp(v) :
    isPrimOp(v) ? v :
    isClosure(v) ? makeProcExp(v.params, v.body) :
    makeLitExp(v);

const applyClosure = (proc: Closure, args: Value[], env: EnvSub): Result<Value> => {
    const vars = map((v: VarDecl) => v.var, proc.params);
    const body = renameExps(proc.body);
    const litArgs : CExp[] = map(valueToLitExp, args);
    return evalSequence(substitute(body, vars, litArgs), env);
    //return evalSequence(substitute(proc.body, vars, litArgs), env);
}

// L31: 
const applyClass = (cls: Class, args: Value[], env: EnvSub): Result<Value> => {
    if (cls.fields.length !== args.length) {
        return makeFailure(`Class expected ${cls.fields.length} arguments, but got ${args.length}`);
    }

    const fieldNames = map((f: VarDecl) => f.var, cls.fields);
    const litArgs = map(valueToLitExp, args);

    // Apply substitution to each method body immediately
    // This "bakes" the field values into the methods
    const substitutedMethods: Binding[] = map((method: Binding): Binding => {
        const newBody = substitute([method.val], fieldNames, litArgs);
        return {
            tag: "Binding",
            var: method.var,
            val: newBody[0] as CExp // The substituted method body
        };
    }, cls.methods);

    // Return an ObjectValue instead of a Closure
    return makeOk(makeObject(substitutedMethods, env));
};

// L31:
const applyObject = (obj: Object, args: Value[], env: EnvSub): Result<Value> => {
    if (args.length === 0) return makeFailure("No method name provided");
    const methodName = args[0];
    if (!isSymbolSExp(methodName)) 
        return makeFailure("Method name must be a symbol");

    // Find the method in the object's baked-in methods
    const method = obj.methods.find(m => m.var.var === methodName.val);
    if (!method) 
        return makeFailure(`Unrecognized method: ${methodName.val}`);

    // The method.val is already substituted, so just eval it
    return bind(L3applicativeEval(method.val, env), (proc: Value) => 
        L3applyProcedure(proc, args.slice(1), env)
    );
};

// Evaluate a sequence of expressions (in a program)
export const evalSequence = (seq: List<Exp>, env: EnvSub): Result<Value> =>
    isNonEmptyList<Exp>(seq) ? 
        isDefineExp(first(seq)) ? evalDefineExps(first(seq), rest(seq), env) :
        evalCExps(first(seq), rest(seq), env) :
    makeFailure("Empty sequence");

const evalCExps = (first: Exp, rest: Exp[], env: EnvSub): Result<Value> =>
    isCExp(first) && isEmpty(rest) ? L3applicativeEval(first, env) :
    isCExp(first) ? bind(L3applicativeEval(first, env), _ => 
                            evalSequence(rest, env)) :
    makeFailure("Never");

// Eval a sequence of expressions when the first exp is a Define.
// Compute the rhs of the define, extend the env with the new binding
// then compute the rest of the exps in the new env.
const evalDefineExps = (def: Exp, exps: Exp[], env: EnvSub): Result<Value> =>
    isDefineExp(def) ? bind(L3applicativeEval(def.val, env), 
                            (rhs: Value) => 
                                evalSequence(exps, 
                                    makeEnv(def.var.var, rhs, env))) :
    makeFailure(`Unexpected in evalDefine: ${format(def)}`);

// Main program
export const evalL3program = (program: Program): Result<Value> =>
    evalSequence(program.exps, makeEmptyEnvSub());

export const evalParse = (s: string): Result<Value> =>
    bind(p(s), (sexp: Sexp) => 
        bind(parseL3Exp(sexp), (exp: Exp) =>
            evalSequence([exp], makeEmptyEnvSub())));
