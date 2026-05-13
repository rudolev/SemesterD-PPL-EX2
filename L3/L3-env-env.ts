// Environment for L4 (support for Letrec)
// =======================================
// An environment represents a partial function from symbols (variable names) to values.
// It supports the operation: apply-env(env,var)
// which either returns the value of var in the environment, or else throws an error.
//
// Env is defined inductively by the following cases:
// * <env> ::= <empty-env> | <extended-env> | <rec-env>
// * <empty-env> ::= (empty-env) // empty-env()
// * <extended-env> ::= (env (symbol+) (value+) next-env) // env(vars:List(Symbol), vals:List(Value), next-env: Env)
// * <rec-ext-env> ::= (rec-env (symbol+) (params+) (bodies+) next-env)
//       // rec-env(vars:List(Symbol), paramss:List(List(var-decl)), bodiess:List(List(cexp)), next-env: Env)
//
// The key operation on env is apply-env(var) which returns the value associated to var in env
// or throw an error if var is not defined in env.

import { VarDecl, CExp, ProcExp } from './L3-ast';
import { makeClosureEnv, Value } from './L3-value';
import { Result, makeOk, makeFailure } from '../shared/result';
import { format } from '../shared/format';

// ========================================================
// Environment data type
export type EnvEnv = EmptyEnvEnv | ExtEnvEnv | RecEnvEnv;
export type EmptyEnvEnv = {tag: "EmptyEnv" }
export type ExtEnvEnv = {
    tag: "ExtEnv";
    vars: string[];
    vals: Value[];
    nextEnv: EnvEnv;
}
export type RecEnvEnv = {
    tag: "RecEnv";
    vars: string[];
    vals : ProcExp[];
    //paramss: VarDecl[][];
    //bodiess: CExp[][];
    nextEnv: EnvEnv;
}

export const makeEmptyEnvEnv = (): EmptyEnvEnv => ({tag: "EmptyEnv"});
export const makeExtEnvEnv = (vs: string[], vals: Value[], env: EnvEnv): ExtEnvEnv =>
    ({tag: "ExtEnv", vars: vs, vals: vals, nextEnv: env});
//export const makeRecEnv = (vs: string[], paramss: VarDecl[][], bodiess: CExp[][], env: Env): RecEnv =>
  //  ({tag: "RecEnv", vars: vs, paramss: paramss, bodiess: bodiess, nextEnv: env});
  export const makeRecEnv = (vs: string[], procs : ProcExp[], env: EnvEnv): RecEnvEnv =>
  ({tag: "RecEnv", vars: vs, vals : procs, nextEnv: env});

const isEmptyEnv = (x: any): x is EmptyEnvEnv => x.tag === "EmptyEnv";
const isExtEnv = (x: any): x is ExtEnvEnv => x.tag === "ExtEnv";
const isRecEnv = (x: any): x is RecEnvEnv => x.tag === "RecEnv";

export const isEnv = (x: any): x is EnvEnv => isEmptyEnv(x) || isExtEnv(x) || isRecEnv(x);

// Apply-env
export const applyEnv = (env: EnvEnv, v: string): Result<Value> =>
    isEmptyEnv(env) ? makeFailure(`var not found: ${v}`) :
    isExtEnv(env) ? applyExtEnv(env, v) :
    applyRecEnv(env, v);

const applyExtEnv = (env: ExtEnvEnv, v: string): Result<Value> =>
    env.vars.includes(v) ? makeOk(env.vals[env.vars.indexOf(v)]) :
    applyEnv(env.nextEnv, v);

//const applyRecEnv = (env: RecEnv, v: string): Result<Value> =>
  //  env.vars.includes(v) ? makeOk(makeClosure(env.paramss[env.vars.indexOf(v)],
    //                                          env.bodiess[env.vars.indexOf(v)],
      //                                        env)) :
    //applyEnv(env.nextEnv, v);

const applyRecEnv = (env: RecEnvEnv, v: string): Result<Value> =>
    env.vars.includes(v) ? makeOk(makeClosureEnv(env.vals[env.vars.indexOf(v)].args,
                                              env.vals[env.vars.indexOf(v)].body,
                                              env)) :
    applyEnv(env.nextEnv, v);
