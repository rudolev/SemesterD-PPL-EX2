import { 
    ClassExp, ProcExp, Exp, CExp, Program, Binding,
    makeProcExp, makeVarDecl, makeIfExp, makeAppExp, 
    makePrimOp, makeVarRef, makeLitExp, 
    isClassExp, isProgram, isDefineExp, isLetExp, 
    isIfExp, isAppExp, isProcExp, makeProgram, 
    makeDefineExp, makeLetExp, makeBinding, isNumExp, 
    isBoolExp, isStrExp, isLitExp, isPrimOp, isVarRef
} from "./L3-ast";
import { makeSymbolSExp } from "./L3-value";
import { Result, makeOk, mapResult, bind } from "../shared/result";

/*
Purpose: Create a nested if given a list of methods.
Signature: class2proc(classExp)
Type: ClassExp => ProcExp
*/
const createNestedIf = (methods: Binding[]): CExp => {
    if (methods.length === 0) {
        return makeLitExp(makeSymbolSExp("error"));
    }
    
    const currentMethod = methods[0];
    const restMethods = methods.slice(1);
    const currentMethodValue = currentMethod.val;
    const methodBody = isProcExp(currentMethodValue) ? currentMethodValue.body[0] : currentMethodValue;

    return makeIfExp(
        makeAppExp(makePrimOp("eq?"), 
        [
            makeVarRef("msg"),
            makeLitExp(makeSymbolSExp(currentMethod.var.var))
        ]),
        methodBody as CExp,
        createNestedIf(restMethods)
    );
};

/*
Purpose: Transform ClassExp to ProcExp
Signature: class2proc(classExp)
Type: ClassExp => ProcExp
*/
export const class2proc = (exp: ClassExp): ProcExp => {
    return makeProcExp(exp.fields, 
        [
            makeProcExp([makeVarDecl("msg")], 
            [createNestedIf(exp.methods)])
        ]
    );
};

/*
Purpose: Transform all class forms in the given AST to procs
Signature: transform(AST)
Type: [Exp | Program] => Result<Exp | Program>
*/
export const transform = (exp: Exp | Program): Result<Exp | Program> =>{
    if (isProgram(exp)) {
        return transformProgram(exp);
    }

    if (isDefineExp(exp)) {
        return bind(transformCExp(exp.val), (val: CExp) => 
            makeOk(makeDefineExp(exp.var, val))
        );
    }

    return transformCExp(exp);
};

/*
Purpose: Transform all class forms within a Program's expressions to procs
Signature: transformProgram(program)
Type: [Program] => Result<Program>
*/
const transformProgram = (program: Program): Result<Program> => {
    const transformedExpsResult = mapResult((e: Exp) => {
        return bind(transform(e), (res: Exp | Program) => 
            makeOk(res as Exp)
        );
    }, program.exps);

    return bind(transformedExpsResult, (exps: Exp[]) => 
        makeOk(makeProgram(exps))
    );
};

/*
Purpose: Recursive helper for Core Expressions
*/
const transformCExp = (exp: CExp): Result<CExp> =>
    isNumExp(exp) ? makeOk(exp) :
    isBoolExp(exp) ? makeOk(exp) :
    isStrExp(exp) ? makeOk(exp) :
    isVarRef(exp) ? makeOk(exp) :
    isPrimOp(exp) ? makeOk(exp) :
    isLitExp(exp) ? makeOk(exp) :
    isClassExp(exp) ? makeOk(class2proc(exp)) :
    isIfExp(exp) ? bind(transformCExp(exp.test), (test: CExp) =>
                    bind(transformCExp(exp.then), (then: CExp) =>
                        bind(transformCExp(exp.alt), (alt: CExp) =>
                            makeOk(makeIfExp(test, then, alt))))) :
    isProcExp(exp) ? bind(mapResult(transformCExp, exp.body), (body: CExp[]) => 
                        makeOk(makeProcExp(exp.args, body))) :
    isAppExp(exp) ? bind(transformCExp(exp.rator), (rator: CExp) =>
                    bind(mapResult(transformCExp, exp.rands), (rands: CExp[]) =>
                        makeOk(makeAppExp(rator, rands)))) :
    isLetExp(exp) ? bind(mapResult(transformBinding, exp.bindings), (bindings: Binding[]) =>
                    bind(mapResult(transformCExp, exp.body), (body: CExp[]) =>
                        makeOk(makeLetExp(bindings, body)))) :
    makeOk(exp);

/*
Helper to transform values inside Let bindings
*/
const transformBinding = (b: Binding): Result<Binding> =>
    bind(transformCExp(b.val), (val: CExp) => makeOk(makeBinding(b.var.var, val)));