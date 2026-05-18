// ========================================================
// Environment data type for L3
import { Value } from './L3-value';
import { Result, makeFailure, makeOk } from '../shared/result';

export type EnvSub = EmptyEnvSub | NonEmptyEnvSub;
export type EmptyEnvSub = {tag: "EmptyEnvSub" }
export type NonEmptyEnvSub = {
    tag: "Env";
    var: string;
    val: Value;
    nextEnv: EnvSub;
}
export const makeEmptyEnvSub = (): EmptyEnvSub => ({tag: "EmptyEnvSub"});
export const makeEnvSub = (v: string, val: Value, env: EnvSub): NonEmptyEnvSub =>
    ({tag: "Env", var: v, val: val, nextEnv: env});
export const isEmptyEnvSub = (x: any): x is EmptyEnvSub => x.tag === "EmptyEnvSub";
export const isNonEmptyEnvSub = (x: any): x is NonEmptyEnvSub => x.tag === "Env";
export const isEnv = (x: any): x is EnvSub => isEmptyEnvSub(x) || isNonEmptyEnvSub(x);

export const applyEnv = (env: EnvSub, v: string): Result<Value> =>
    isEmptyEnvSub(env) ? makeFailure(`var not found: ${v}`) :
    env.var === v ? makeOk(env.val) :
    applyEnv(env.nextEnv, v);

