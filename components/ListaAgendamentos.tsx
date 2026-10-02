import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image } from 'react-native'; 
import { Medicamento } from '../database'; 

interface Props {
  medicamentos: Medicamento[];
  perguntarRemover: (id: number) => void;
  isDarkMode: boolean; // Recebe o tema do index.tsx
}

export default function ListaAgendamentos({ medicamentos, perguntarRemover, isDarkMode }: Props) {
  return (
    <View style={styles.areaAba}>
      <Text style={[styles.tituloSecaoLista, isDarkMode && styles.textoDark]}>Lista de agendamentos</Text>
      
      <FlatList data={medicamentos} keyExtractor={(item) => item.id.toString()} style={styles.lista}
        ListEmptyComponent={<Text style={[styles.listaVazia, isDarkMode && styles.subtextoDark]}>Nenhum registro encontrado.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.itemLista, isDarkMode && styles.itemListaDark]}>
            <View style={styles.textosDaLista}>
              <Text style={[styles.itemNome, isDarkMode && styles.textoDark]}>{item.nome}</Text>
              <Text style={[styles.itemDetalhes, isDarkMode && styles.subtextoDark]}>{item.dosagem} às {item.horario}</Text>
            </View>
            
            <TouchableOpacity onPress={() => perguntarRemover(item.id)}>
              <Image 
                source={require('../assets/images/lixeira.png')} 
                style={{ width: 28, height: 28, resizeMode: 'contain', tintColor: '#DC3545' }} 
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
  
  textoDark: { color: '#FFFFFF' },
  subtextoDark: { color: '#AAAAAA' },
  
  lista: { flex: 1, marginBottom: 10 },
  
  itemLista: { backgroundColor: '#FFFFFF', padding: 15, borderBottomWidth: 1, borderBottomColor: '#EEEEEE', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderRadius: 8 },
  itemListaDark: { backgroundColor: '#1E1E1E', borderBottomColor: '#333333' },
  
  textosDaLista: { flex: 1 }, 
  itemNome: { color: '#000000', fontSize: 18, fontWeight: 'bold' }, 
  itemDetalhes: { color: '#555555', fontSize: 14, marginTop: 4 },
  
  listaVazia: { color: '#888888', textAlign: 'center', marginTop: 20, fontSize: 16 }
});