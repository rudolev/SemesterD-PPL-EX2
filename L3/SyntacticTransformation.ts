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
Purpose: Transform ClassExp to ProcExp
Signature: class2proc(classExp)
Type: ClassExp => ProcExp
*/
export const class2proc = (exp: ClassExp): ProcExp => {
    const nestedIf = (methods: Binding[]): CExp => {
        if (methods.length === 0) {
            return makeLitExp(makeSymbolSExp("error"));
        }
        const currentMethod = methods[0];
        const restMethods = methods.slice(1);

        // Check if the method value is a ProcExp (lambda)
        // If it is, we take the FIRST expression from its body
        const methodValue = currentMethod.val;
        const methodBody = isProcExp(methodValue) ? methodValue.body[0] : methodValue;

        return makeIfExp(
            makeAppExp(makePrimOp("eq?"), [
                makeVarRef("msg"),
                makeLitExp(makeSymbolSExp(currentMethod.var.var))
            ]),
            methodBody as CExp, // Use the body directly, don't wrap it in an application
            nestedIf(restMethods)
        );
    };

    return makeProcExp(exp.fields, [
        makeProcExp([makeVarDecl("msg")], [nestedIf(exp.methods)])
    ]);
};

/*
Purpose: Transform all class forms in the given AST to procs
Signature: transform(AST)
Type: [Exp | Program] => Result<Exp | Program>
*/
export const transform = (exp: Exp | Program): Result<Exp | Program> =>
    isProgram(exp) ? bind(
                        // Force the mapResult to treat the result as Exp[]
                        mapResult((e: Exp) => bind(transform(e), (res: Exp | Program) => makeOk(res as Exp)), exp.exps), 
                        (exps: Exp[]) => makeOk(makeProgram(exps))
                     ) :
    isDefineExp(exp) ? bind(transformCExp(exp.val), (val: CExp) => makeOk(makeDefineExp(exp.var, val))) :
    transformCExp(exp);

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