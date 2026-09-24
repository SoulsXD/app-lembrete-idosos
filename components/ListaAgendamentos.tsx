import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image } from 'react-native'; // Adicionado o Image aqui
import { Medicamento } from '../database'; 

interface Props {
  medicamentos: Medicamento[];
  perguntarRemover: (id: number) => void;
}

export default function ListaAgendamentos({ medicamentos, perguntarRemover }: Props) {
  return (
    <View style={styles.areaAba}>
      <Text style={styles.tituloSecaoLista}>lista de agendamentos</Text>
      <FlatList data={medicamentos} keyExtractor={(item) => item.id.toString()} style={styles.lista}
        ListEmptyComponent={<Text style={styles.listaVazia}>nenhum registro encontrado</Text>}
        renderItem={({ item }) => (
          <View style={styles.itemLista}>
            <View style={styles.textosDaLista}>
              <Text style={styles.itemNome}>{item.nome}</Text>
              <Text style={styles.itemDetalhes}>{item.dosagem} as {item.horario}</Text>
            </View>
            
            {/* excluir com modal de confirmação */}
            <TouchableOpacity onPress={() => perguntarRemover(item.id)}>
              <Image 
                source={require('../../assets/images/lixeira.png')} 
                style={{ width: 28, height: 28, resizeMode: 'contain',}} 
              />
            </TouchableOpacity>

          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  areaAba: { flex: 1, paddingHorizontal: 20 },
  tituloSecaoLista: { color: '#333333', fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }, 
  lista: { flex: 1, marginBottom: 10 },
  itemLista: { backgroundColor: '#FFFFFF', padding: 15, borderBottomWidth: 1, borderBottomColor: '#EEEEEE', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderRadius: 8 },
  textosDaLista: { flex: 1 }, 
  itemNome: { color: '#000000', fontSize: 18, fontWeight: 'bold' }, 
  itemDetalhes: { color: '#555555', fontSize: 14, marginTop: 4 },
  listaVazia: { color: '#888888', textAlign: 'center', marginTop: 20, fontSize: 16 }
});