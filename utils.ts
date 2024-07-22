export async function processUserKeys(data: string): Promise<string[]>{
    return data.split(' ');
}